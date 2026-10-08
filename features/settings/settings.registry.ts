// Admin-editable runtime settings, shared by the client form and the server. NO server-only imports.

export type SettingType = "text" | "email" | "url" | "number" | "boolean" | "password"

export interface SettingField {
  key: string
  label: string
  type: SettingType
  group: string
  placeholder?: string
  /** Stored encrypted; the value is never sent back to the client. */
  secret?: boolean
  required?: boolean
  help?: string
}

export const SETTING_FIELDS: SettingField[] = [
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

  {
    key: "HR_EMAIL",
    label: "HR inbox",
    type: "email",
    group: "HR",
    placeholder: "hr@example.com",
    help: "Resignation requests are sent here.",
  },

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

  // Stored here because the local key FILE is gitignored and never deployed.
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

  {
    key: "GSC_CREDENTIALS",
    label: "Search Console service account JSON",
    type: "password",
    group: "Google Search Console",
    secret: true,
    help: "Optional. Leave blank to reuse the Google Drive service account. Set it only if Search Console is in a different Cloud project. Paste the key JSON on ONE line (minified). Whichever account is used must (a) have the Search Console API enabled on ITS Cloud project and (b) be added as a user on each property.",
  },
  {
    key: "GA4_CREDENTIALS",
    label: "GA4 service account JSON",
    type: "password",
    group: "Google Search Console",
    secret: true,
    help: "Optional. Leave blank to reuse the Google Drive service account. Needs the 'Google Analytics Data API' enabled on its Cloud project, and the account added under GA4 -> Admin -> Property access management (Viewer).",
  },
  {
    key: "GOOGLE_PSI_API_KEY",
    label: "PageSpeed Insights API key",
    type: "password",
    group: "Google Search Console",
    secret: true,
    help: "Required for Core Web Vitals. Without a key, calls are billed to Google's shared anonymous project, whose daily allowance is normally already spent - so measurements fail with HTTP 429 rather than merely running slowly. A key of your own is free and gives 25,000 calls/day. Google Cloud Console -> enable 'PageSpeed Insights API' -> Credentials -> API key.",
  },
  {
    key: "INDEXNOW_KEY",
    label: "IndexNow key",
    type: "password",
    group: "Google Search Console",
    secret: true,
    help: "Optional. A hex key (8-128 chars) for instant recrawl pings to Bing/Yandex/Seznam/Naver. Each tracked site must host it at https://<host>/<key>.txt containing exactly the key.",
  },

  {
    key: "REFERRAL_REWARD_PERCENT",
    label: "Referral reward (% of monthly salary)",
    type: "number",
    group: "Referrals",
    placeholder: "10",
    help: "Paid to the referrer once the person they referred completes one year. Calculated from that new joiner's monthly salary at the time of payout. Blank or 0 disables the reward, and referrals are still tracked.",
  },
]

export const SETTING_KEYS = SETTING_FIELDS.map((f) => f.key)
export const SECRET_KEYS = new Set(SETTING_FIELDS.filter((f) => f.secret).map((f) => f.key))
export const REQUIRED_KEYS = new Set(SETTING_FIELDS.filter((f) => f.required).map((f) => f.key))

/** UI group order = first appearance in SETTING_FIELDS. */
export const SETTING_GROUPS = [...new Set(SETTING_FIELDS.map((f) => f.group))]
