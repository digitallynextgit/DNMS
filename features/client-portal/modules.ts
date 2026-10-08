// THE allowlist of portal modules. Unknown keys are ignored, so a stale key narrows access, never
// widens it. Staff-only data (passwords, hours, budget, audit_logs, messages) is never a module.
// Client-safe: the admin package editor renders from it too.

export type ClientModuleKey =
  | "plan"
  | "documents"
  | "calendars"
  | "products"
  | "channels"
  | "inventory"
  | "mailer"
  | "activity"

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
    key: "plan",
    label: "Content plan",
    // Modules the client can WRITE to say so in their description.
    description:
      "What is planned between two dates and what has been made against it. The client can add plan items, attach finished work, and finalise or send back what the team delivers.",
    path: "plan",
  },
  {
    key: "documents",
    label: "Documents & assets",
    description:
      "Shared process documents and campaign assets, to read and download. The client can upload files here.",
    path: "documents",
  },
  {
    key: "calendars",
    label: "Calendars",
    description:
      "Content calendars the team has shared with this client. They can fill cells and add rows; the columns and the calendars themselves stay yours. Each calendar is shared individually from the project.",
    path: "calendars",
  },
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
