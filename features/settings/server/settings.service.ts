import "server-only"

import { db } from "@/server/db"
import { PERMISSIONS } from "@/lib/constants"
import { encrypt } from "@/lib/crypto"
import { createAuditLog } from "@/lib/audit"
import { requirePermission, getAuditMeta } from "@/server/action-guard"
import { ok, fail, runAction, type ActionResult } from "@/server/action-result"
import { reloadConfig } from "@/server/app-config"
import { SETTING_FIELDS, SECRET_KEYS } from "@/features/settings/settings.registry"

export interface SettingValue {
  key: string
  /** Effective value for non-secret keys (DB override or env). Empty for secrets. */
  value: string
  /** Whether a value is configured (DB or env). For secrets this is all the UI gets. */
  isSet: boolean
  /** True when the value comes from the DB (an admin override) rather than env. */
  overridden: boolean
}

// ---------------------------------------------------------------------------
// getSettings - current effective config for the Integrations page. Secret
// values are NEVER returned; only whether they are set.
// ---------------------------------------------------------------------------
export async function getSettings(): Promise<ActionResult<{ data: SettingValue[] }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.SETTINGS_WRITE)
    const rows = await db.appSetting.findMany()
    const dbMap = new Map(rows.map((r) => [r.key, r.value]))

    const data: SettingValue[] = SETTING_FIELDS.map((f) => {
      const dbValue = dbMap.get(f.key) ?? null
      const envValue = process.env[f.key] ?? ""
      if (f.secret) {
        return { key: f.key, value: "", isSet: !!dbValue || !!envValue, overridden: !!dbValue }
      }
      const value = (dbValue ?? envValue) || ""
      return { key: f.key, value, isSet: !!value, overridden: dbValue != null }
    })
    return ok({ data })
  })
}

// ---------------------------------------------------------------------------
// updateSettings - upsert the provided keys. Blank secret = keep existing;
// blank non-secret = revert to env (delete the override).
// ---------------------------------------------------------------------------
export async function updateSettings(
  values: Record<string, string>,
): Promise<ActionResult<{ updated: number }>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.SETTINGS_WRITE)

    // Required fields (the mandatory notifications mailer) must never be left
    // blank. A blank secret is allowed only when a value is already stored
    // (blank means "keep the existing secret").
    const requiredBlank: string[] = []
    for (const field of SETTING_FIELDS) {
      if (!field.required || !(field.key in values)) continue
      const raw = values[field.key]
      const value = typeof raw === "string" ? raw.trim() : ""
      if (value !== "") continue
      if (field.secret) {
        const existing = await db.appSetting.findUnique({ where: { key: field.key } })
        if (existing?.value || process.env[field.key]) continue
      }
      requiredBlank.push(field.label)
    }
    if (requiredBlank.length > 0) {
      return fail(`Required and cannot be empty: ${requiredBlank.join(", ")}`)
    }

    const changedKeys: string[] = []
    for (const field of SETTING_FIELDS) {
      if (!(field.key in values)) continue
      const raw = values[field.key]
      const value = typeof raw === "string" ? raw.trim() : ""

      if (SECRET_KEYS.has(field.key)) {
        if (value === "") continue // blank → leave the stored secret untouched
        await db.appSetting.upsert({
          where: { key: field.key },
          create: { key: field.key, value: encrypt(value), isSecret: true },
          update: { value: encrypt(value), isSecret: true },
        })
        changedKeys.push(field.key)
      } else if (value === "") {
        const removed = await db.appSetting.deleteMany({ where: { key: field.key } })
        if (removed.count) changedKeys.push(field.key)
      } else {
        await db.appSetting.upsert({
          where: { key: field.key },
          create: { key: field.key, value, isSecret: false },
          update: { value, isSecret: false },
        })
        changedKeys.push(field.key)
      }
    }

    await reloadConfig()

    const meta = await getAuditMeta()
    await createAuditLog(session, {
      action: "SETTINGS_UPDATE",
      module: "admin",
      entityType: "AppSetting",
      entityId: "app_settings",
      // Never log secret values; just the keys that changed.
      changes: { keys: changedKeys },
      ...meta,
    })

    return ok({ updated: changedKeys.length })
  })
}
