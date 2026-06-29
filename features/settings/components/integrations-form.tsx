"use client"

import { useState } from "react"
import { CheckCircle2, Info, Loader2, Pencil, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  SETTING_FIELDS,
  SETTING_GROUPS,
  type SettingField,
} from "@/features/settings/settings.registry"
import { useUpdateSettings, type SettingValue } from "@/features/settings/hooks/use-settings"

// What changing each group affects - shown in the "Are you sure?" modal.
const GROUP_IMPACT: Record<string, string> = {
  General: "These control the app name, public URL and the logo shown at the top of every email.",
  HR: "This controls which inbox receives resignation requests. A wrong address means HR won't be notified.",
  "Default mailer":
    "This is the SMTP server used for most system emails. An incorrect value will stop those emails from being delivered.",
  "Notifications mailer":
    "Required. The guaranteed fallback mailer - whenever the Default or HR mailer isn't configured, mail is sent through this one. It must always stay fully configured.",
  "HR mailer":
    "This is the SMTP server used for HR emails. An incorrect value will stop HR emails from being delivered.",
  "Storage (B2)":
    "Backblaze B2 bucket for uploaded files (documents, profile photos, resumes). Incorrect values will break uploads and downloads.",
}

export function IntegrationsForm({ settings }: { settings: SettingValue[] }) {
  const byKey = new Map(settings.map((s) => [s.key, s]))
  return (
    <div className="space-y-6">
      {SETTING_GROUPS.map((group) => (
        <SettingsGroupCard
          key={group}
          group={group}
          fields={SETTING_FIELDS.filter((f) => f.group === group)}
          byKey={byKey}
        />
      ))}
    </div>
  )
}

function snapshot(
  fields: SettingField[],
  byKey: Map<string, SettingValue>,
): Record<string, string> {
  const v: Record<string, string> = {}
  // Secrets always start blank (we never receive the value); others from current.
  for (const f of fields) v[f.key] = f.secret ? "" : (byKey.get(f.key)?.value ?? "")
  return v
}

function SettingsGroupCard({
  group,
  fields,
  byKey,
}: {
  group: string
  fields: SettingField[]
  byKey: Map<string, SettingValue>
}) {
  const configured = fields.some((f) => byKey.get(f.key)?.isSet)
  // "Complete" = every non-boolean field has a value (booleans default to off).
  const complete = fields.filter((f) => f.type !== "boolean").every((f) => byKey.get(f.key)?.isSet)
  // A group is required when any of its fields are - the notifications mailer.
  const groupRequired = fields.some((f) => f.required)
  // Unconfigured groups open straight into editing; configured ones are locked.
  const [editing, setEditing] = useState(!configured)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string>>(() => snapshot(fields, byKey))
  const updateMut = useUpdateSettings()

  const set = (key: string, value: string) => setValues((p) => ({ ...p, [key]: value }))

  function startEdit() {
    setValues(snapshot(fields, byKey))
    setConfirmOpen(false)
    setEditing(true)
  }

  function cancel() {
    setValues(snapshot(fields, byKey))
    setEditing(false)
  }

  // Only changed fields: non-secrets that differ, secrets the user actually typed.
  function changedPayload(): Record<string, string> {
    const payload: Record<string, string> = {}
    for (const f of fields) {
      const next = values[f.key] ?? ""
      if (f.secret) {
        if (next.trim() !== "") payload[f.key] = next
      } else if (next !== (byKey.get(f.key)?.value ?? "")) {
        payload[f.key] = next
      }
    }
    return payload
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = changedPayload()
    if (Object.keys(payload).length === 0) {
      setEditing(false)
      return
    }
    updateMut.mutate(payload, { onSuccess: () => setEditing(false) })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex min-w-0 items-center gap-2">
          <CardTitle className="truncate text-base">{group}</CardTitle>
          {groupRequired && (
            <span className="bg-muted text-muted-foreground shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase">
              Required
            </span>
          )}
          {complete ? (
            <CheckCircle2
              className="h-4 w-4 shrink-0 text-emerald-500"
              aria-label="All values configured"
            />
          ) : (
            <XCircle
              className="text-destructive h-4 w-4 shrink-0"
              aria-label="Some values missing"
            />
          )}
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  aria-label={`About ${group}`}
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                {GROUP_IMPACT[group] ?? "Settings for this section."}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
        )}
      </CardHeader>

      <CardContent>
        {editing ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              {fields.map((f) => (
                <FieldInput
                  key={f.key}
                  field={f}
                  value={values[f.key] ?? ""}
                  meta={byKey.get(f.key)}
                  onChange={(v) => set(f.key, v)}
                />
              ))}
            </div>
            <div className="flex items-center justify-end gap-2">
              {configured && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={cancel}
                  disabled={updateMut.isPending}
                >
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={updateMut.isPending}>
                {updateMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save {group}
              </Button>
            </div>
          </form>
        ) : (
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key} className="min-w-0">
                <dt className="text-muted-foreground text-xs">{f.label}</dt>
                <dd className="truncate text-sm font-medium">
                  {displayValue(f, byKey.get(f.key))}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Edit ${group} settings?`}
        description={`${GROUP_IMPACT[group] ?? "These settings affect the running app."} Changes take effect immediately after you save.`}
        confirmLabel="Yes, edit"
        onConfirm={startEdit}
      />
    </Card>
  )
}

function displayValue(field: SettingField, meta?: SettingValue): string {
  if (field.secret) return meta?.isSet ? "••••••••" : "Not set"
  if (field.type === "boolean") return meta?.value === "true" ? "On" : "Off"
  return meta?.value || "Not set"
}

function FieldInput({
  field,
  value,
  meta,
  onChange,
}: {
  field: SettingField
  value: string
  meta?: SettingValue
  onChange: (v: string) => void
}) {
  if (field.type === "boolean") {
    return (
      <div className="flex items-center justify-between rounded border px-3 py-2.5 sm:col-span-2">
        <Label htmlFor={field.key} className="mb-0 cursor-pointer">
          {field.label}
        </Label>
        <Switch
          id={field.key}
          checked={value === "true"}
          onCheckedChange={(c) => onChange(c ? "true" : "false")}
        />
      </div>
    )
  }

  const isPassword = field.type === "password"
  // A set secret may be left blank (keeps the existing value), so it isn't
  // natively required; everything else required must carry a value.
  const nativeRequired = field.required && !(field.secret && meta?.isSet)
  return (
    <div>
      <Label htmlFor={field.key}>
        {field.label}
        {field.required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input
        id={field.key}
        type={isPassword ? "password" : field.type === "number" ? "number" : "text"}
        value={value}
        required={nativeRequired}
        autoComplete={isPassword ? "new-password" : "off"}
        placeholder={
          isPassword && meta?.isSet
            ? "•••••••••••• (set - leave blank to keep)"
            : (field.placeholder ?? "")
        }
        onChange={(e) => onChange(e.target.value)}
      />
      {field.help && <p className="text-muted-foreground mt-1 text-xs">{field.help}</p>}
    </div>
  )
}
