// Public marketing site metadata. `url` follows NEXT_PUBLIC_APP_URL (canonical, OpenGraph, sitemap).
export const siteConfig = {
  name: "DNMS",
  fullName: "Digitally Next Management System",
  company: "Digitally Next",
  tagline: "Run your entire company on one platform",
  defaultTitle: "DNMS - Run your entire company on one platform",
  description:
    "DNMS is an all-in-one company management platform: HR, biometric attendance, leave & WFH, payroll, performance, projects, recruitment, a client portal, SEO tools and team chat, all in one secure, permission-controlled system.",
  url:
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "https://dnms.digitallynext.com",
  contactEmail: "sales@digitallynext.com",

  /** For copy and legal text. Not `url`, which is localhost in development. */
  domain: "dnms.digitallynext.com",

  // Legal identity for the legal pages and Organization structured data.
  // TODO: replace the placeholders with the registered details.
  legal: {
    entity: "Digitally Next",
    address: "New Delhi, India",
    jurisdiction: "New Delhi, India",
    governingLaw: "the laws of India",
    // `as string`: an empty literal in an `as const` object makes `{cin && ...}` look unreachable.
    cin: "" as string,
    gstin: "" as string,
  },

  emails: {
    sales: "sales@digitallynext.com",
    support: "support@digitallynext.com",
    privacy: "privacy@digitallynext.com",
    /** Grievance Officer, required by India's DPDP Act and the IT Rules. */
    grievance: "grievance@digitallynext.com",
  },

  /** Empty strings are hidden in the UI. */
  contact: {
    phone: "" as string,
    hours: "Monday to Friday, 10:00-18:30 IST" as string,
  },
  keywords: [
    "HR software",
    "HRMS",
    "workforce management",
    "biometric attendance software",
    "leave management system",
    "payroll software",
    "performance management",
    "project management",
    "applicant tracking system",
    "client portal",
    "employee management system",
    "SEO management tool",
    "company management platform",
  ],
} as const

export type SiteConfig = typeof siteConfig
