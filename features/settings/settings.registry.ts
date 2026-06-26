// Single source of truth for admin-editable runtime settings (Integrations
// page). Shared by the client form (labels/groups/types) and the server
// (which keys exist, which are secret). NO server-only imports here.

export type SettingType = "text" | "email" | "url" | "number" | "boolean" | "password"

export interface SettingField {
  key: string
  label: string
  type: SettingType
  group: string
  placeholder?: string
  /** Stored encrypted; the value is never sent back to the client. */
  secret?: boolean
  help?: string
}

export const SETTING_FIELDS: SettingField[] = [
  // ── General ────────────────────────────────────────────────────────────────
  { key: "APP_NAME", label: "App name", type: "text", group: "General", placeholder: "DNMS" },
  {
    key: "APP_URL",
    label: "App URL",
    type: "url",
    group: "General",
    placeholder: "https://app.example.com",
    help: "Used for links in emails.",
  },
  {
    key: "EMAIL_LOGO_URL",
    label: "Email logo URL",
    type: "url",
    group: "General",
    placeholder: "https://…/logo.png",
    help: "Public PNG/WEBP shown at the top of every email.",
  },

  // ── HR ───────────────────────────────────────────────────────────────────
  {
    key: "HR_EMAIL",
    label: "HR inbox",
    type: "email",
    group: "HR",
    placeholder: "hr@example.com",
    help: "Resignation requests are sent here.",
  },

  // ── Default mailer ─────────────────────────────────────────────────────────
  {
    key: "SMTP_FROM",
    label: "From",
    type: "text",
    group: "Default mailer",
    placeholder: "DNMS <noreply@example.com>",
  },
  {
    key: "SMTP_HOST",
    label: "Host",
    type: "text",
    group: "Default mailer",
    placeholder: "smtp.gmail.com",
  },
  { key: "SMTP_PORT", label: "Port", type: "number", group: "Default mailer", placeholder: "587" },
  { key: "SMTP_SECURE", label: "Use TLS (SSL)", type: "boolean", group: "Default mailer" },
  { key: "SMTP_USER", label: "Username", type: "text", group: "Default mailer" },
  { key: "SMTP_PASS", label: "Password", type: "password", group: "Default mailer", secret: true },

  // ── HR mailer ──────────────────────────────────────────────────────────────
  {
    key: "SMTP_HR_FROM",
    label: "From",
    type: "text",
    group: "HR mailer",
    placeholder: "HR <hr@example.com>",
  },
  {
    key: "SMTP_HR_HOST",
    label: "Host",
    type: "text",
    group: "HR mailer",
    placeholder: "smtp-relay.brevo.com",
  },
  { key: "SMTP_HR_PORT", label: "Port", type: "number", group: "HR mailer", placeholder: "587" },
  { key: "SMTP_HR_SECURE", label: "Use TLS (SSL)", type: "boolean", group: "HR mailer" },
  { key: "SMTP_HR_USER", label: "Username", type: "text", group: "HR mailer" },
  { key: "SMTP_HR_PASS", label: "Password", type: "password", group: "HR mailer", secret: true },
]

export const SETTING_KEYS = SETTING_FIELDS.map((f) => f.key)
export const SECRET_KEYS = new Set(SETTING_FIELDS.filter((f) => f.secret).map((f) => f.key))

/** Group order as they should appear in the UI (insertion order of the array). */
export const SETTING_GROUPS = [...new Set(SETTING_FIELDS.map((f) => f.group))]
