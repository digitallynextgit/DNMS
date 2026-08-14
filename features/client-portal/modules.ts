// =============================================================================
// Client portal module registry
// =============================================================================
// THE allowlist. A package stores module KEYS; this file is the only place that
// decides what a key means and what it unlocks. Two rules make it safe:
//
//   1. A key not listed here is ignored at read time (see resolveModules), so a
//      typo or a stale key left in a package NARROWS access, never widens it.
//   2. Nothing in the portal reads project data without first asking
//      `canAccessModule` - there is no "and also show…" path.
//
// Deliberately NOT here, and not addable without a code change: project
// passwords, timesheets/hours, budget, INTERNAL activity (audit_logs) and staff
// messages. Those are staff-only by construction, not by configuration.
//
// Note the "activity" module below is NOT that. It reads client_activity_logs -
// the client's own actions, scoped to their own account - and never touches
// audit_logs, which is where staff activity lives. The two are separate tables
// for exactly this reason.
//
// Client-safe (no server imports): the admin package editor renders from it too.
// =============================================================================

export type ClientModuleKey = "products" | "channels" | "inventory" | "mailer" | "activity"

export interface ClientModule {
  key: ClientModuleKey
  label: string
  /** Shown under the label in the package editor. */
  description: string
  /** Portal route segment under /portal/[projectId]. */
  path: string
}

export const CLIENT_MODULES: readonly ClientModule[] = [
  {
    key: "products",
    label: "Product catalog",
    description: "Product titles, images, SKUs, pricing and live listing links.",
    path: "products",
  },
  {
    key: "channels",
    label: "Sales channels",
    description: "Which marketplace each product is listed on, and its sync state.",
    path: "channels",
  },
  {
    key: "inventory",
    label: "Inventory",
    description: "Stock on hand per product, with out-of-stock and low-stock counts.",
    path: "inventory",
  },
  {
    key: "mailer",
    label: "Email campaigns",
    // Says plainly that this one SENDS, unlike every other module, which only
    // shows data. Whoever ticks this box should know that before they tick it.
    description:
      "Compose and send campaigns from the project's own address, with templates and the subscriber list. This module can send email to real people.",
    path: "mailer",
  },
  {
    key: "activity",
    label: "Activity",
    description: "A record of what this client has done in the portal. Their own actions only.",
    path: "activity",
  },
] as const

const MODULE_KEYS = new Set<string>(CLIENT_MODULES.map((m) => m.key))

/** Narrow raw package strings to keys this build actually understands. */
export function resolveModules(raw: readonly string[] | null | undefined): ClientModuleKey[] {
  if (!raw?.length) return []
  return raw.filter((k): k is ClientModuleKey => MODULE_KEYS.has(k))
}

export function isClientModule(key: string): key is ClientModuleKey {
  return MODULE_KEYS.has(key)
}

export function moduleByKey(key: ClientModuleKey): ClientModule | undefined {
  return CLIENT_MODULES.find((m) => m.key === key)
}
