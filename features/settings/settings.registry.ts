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
  /** Must always have a value - cannot be saved blank or cleared. */
  required?: boolean
  help?: string
}

export const SETTING_FIELDS: SettingField[] = [
  // ── Company (email signature) ──────────────────────────────────────────────
  // Used to build the signature block on staff-authored emails (e.g. a leave
  // application). Settings rather than constants so they can be corrected without
  // a redeploy. A blank social simply hides that link.
  {
    key: "COMPANY_WEBSITE",
    label: "Website",
    type: "text",
    group: "Company",
    placeholder: "www.digitallynext.com",
    help: "Shown in the email signature.",
  },
  {
    key: "COMPANY_ADDRESS",
    label: "Office address",
    type: "text",
    group: "Company",
    placeholder: "268 Business India Complex, Uday Park, New Delhi 110 049, India",
  },
  {
    key: "SOCIAL_LINKEDIN",
    label: "LinkedIn URL",
    type: "url",
    group: "Company",
    placeholder: "https://www.linkedin.com/company/...",
    help: "Leave blank to hide it from the signature.",
  },
  {
    key: "SOCIAL_INSTAGRAM",
    label: "Instagram URL",
    type: "url",
    group: "Company",
    placeholder: "https://www.instagram.com/...",
  },
  {
    key: "SOCIAL_YOUTUBE",
    label: "YouTube URL",
    type: "url",
    group: "Company",
    placeholder: "https://www.youtube.com/@...",
  },

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

  // ── Notifications mailer (REQUIRED fallback) ─────────────────────────────────
  // This profile must always be fully configured: it is the guaranteed fallback
  // used to send mail whenever the Default or HR mailer isn't set up.
  {
    key: "SMTP_NOTIFICATIONS_FROM",
    label: "From",
    type: "text",
    group: "Notifications mailer",
    placeholder: "DNMS <no-reply@example.com>",
    required: true,
    help: "Used as the fallback sender when other mailers aren't configured.",
  },
  {
    key: "SMTP_NOTIFICATIONS_HOST",
    label: "Host",
    type: "text",
    group: "Notifications mailer",
    placeholder: "smtp-relay.brevo.com",
    required: true,
  },
  {
    key: "SMTP_NOTIFICATIONS_PORT",
    label: "Port",
    type: "number",
    group: "Notifications mailer",
    placeholder: "587",
    required: true,
  },
  {
    key: "SMTP_NOTIFICATIONS_SECURE",
    label: "Use TLS (SSL)",
    type: "boolean",
    group: "Notifications mailer",
  },
  {
    key: "SMTP_NOTIFICATIONS_USER",
    label: "Username",
    type: "text",
    group: "Notifications mailer",
    required: true,
  },
  {
    key: "SMTP_NOTIFICATIONS_PASS",
    label: "Password",
    type: "password",
    group: "Notifications mailer",
    secret: true,
    required: true,
  },

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

  // ── Storage (Backblaze B2, S3-compatible) ────────────────────────────────────
  {
    key: "B2_EMPLOYEE_DOCS_ENDPOINT",
    label: "Endpoint",
    type: "url",
    group: "Storage (B2)",
    placeholder: "https://s3.us-east-005.backblazeb2.com",
  },
  {
    key: "B2_EMPLOYEE_DOCS_REGION",
    label: "Region",
    type: "text",
    group: "Storage (B2)",
    placeholder: "us-east-005",
  },
  { key: "B2_EMPLOYEE_DOCS_BUCKET", label: "Bucket", type: "text", group: "Storage (B2)" },
  { key: "B2_EMPLOYEE_DOCS_KEY_ID", label: "Key ID", type: "text", group: "Storage (B2)" },
  {
    key: "B2_EMPLOYEE_DOCS_APP_KEY",
    label: "Application key",
    type: "password",
    group: "Storage (B2)",
    secret: true,
  },

  // ── Google Drive (service account -> company Shared Drive) ───────────────────
  // Stored here so the DEPLOYED server can read them (the local key FILE is
  // gitignored and never deployed). Config resolves DB -> env, so pasting these on
  // the Integrations page makes project Drive files work in production.
  {
    key: "GOOGLE_DRIVE_SHARED_DRIVE_ID",
    label: "Shared Drive ID",
    type: "text",
    group: "Google Drive",
    placeholder: "0ALcE76yNtuFUUk9PVA",
    help: "The company Shared Drive that holds project files (the id in its Drive URL).",
  },
  {
    key: "GOOGLE_DRIVE_CREDENTIALS",
    label: "Service account JSON",
    type: "password",
    group: "Google Drive",
    secret: true,
    help: "Paste the whole service-account key JSON on ONE line (minified). Stored encrypted.",
  },
]

export const SETTING_KEYS = SETTING_FIELDS.map((f) => f.key)
export const SECRET_KEYS = new Set(SETTING_FIELDS.filter((f) => f.secret).map((f) => f.key))
export const REQUIRED_KEYS = new Set(SETTING_FIELDS.filter((f) => f.required).map((f) => f.key))

/** Group order as they should appear in the UI (insertion order of the array). */
export const SETTING_GROUPS = [...new Set(SETTING_FIELDS.map((f) => f.group))]
