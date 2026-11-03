// The web analytics setup checklist under each project's Analytics tab. Keys are stored per project,
// so renaming an item is safe; changing a key makes a new item (and orphans the old row).

export const WEB_CHECKLIST_STATUSES = ["NOT_STARTED", "DONE", "NOT_APPLICABLE"] as const

export type WebChecklistStatus = (typeof WEB_CHECKLIST_STATUSES)[number]

export const WEB_CHECKLIST_STATUS_LABELS: Record<WebChecklistStatus, string> = {
  NOT_STARTED: "Not started",
  DONE: "Done",
  NOT_APPLICABLE: "Not applicable",
}

export const WEB_CHECKLIST_ITEMS: readonly { key: string; text: string }[] = [
  { key: "google-analytics", text: "Google Analytics" },
  { key: "google-tag-manager", text: "Google Tag Manager" },
  { key: "microsoft-clarity", text: "Microsoft Clarity" },
  { key: "google-search-console", text: "Google Search Console" },
  { key: "google-cloud-console", text: "Google Cloud Console" },
  { key: "meta-pixel", text: "Meta Pixel" },
  { key: "google-ads", text: "Google Ads conversion tracking" },
  { key: "mails-initiated", text: "Mails initiated" },
]

export const WEB_CHECKLIST_TOTAL = WEB_CHECKLIST_ITEMS.length

export const WEB_CHECKLIST_KEYS = new Set(WEB_CHECKLIST_ITEMS.map((i) => i.key))

export interface WebChecklistItemView {
  key: string
  text: string
  status: WebChecklistStatus
  statusAt: string | Date | null
  statusBy: { id: string; firstName: string; lastName: string } | null
  note: string | null
}

export interface WebChecklistView {
  /** Items in each status. */
  counts: Record<WebChecklistStatus, number>
  /** Items that still apply (everything except Not applicable), so progress is done / applicable. */
  applicable: number
  total: number
  items: WebChecklistItemView[]
}

export function isWebChecklistStatus(v: string): v is WebChecklistStatus {
  return (WEB_CHECKLIST_STATUSES as readonly string[]).includes(v)
}
