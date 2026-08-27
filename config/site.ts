/**
 * Central site metadata for the public marketing surface (landing page, SEO
 * metadata, sitemap, structured data). Keep public-facing copy and links here so
 * they are edited in one place.
 *
 * `url` drives canonical URLs, OpenGraph and the sitemap - set NEXT_PUBLIC_APP_URL
 * in production. contactEmail / demo links are placeholders on the digitallynext
 * domain; change them to your real sales inbox.
 */
export const siteConfig = {
  name: "DNMS",
  fullName: "Digitally Next Management System",
  company: "Digitally Next",
  tagline: "Run your entire company on one platform",
  // Single source for the default/OG title so it stays em-dash-free everywhere.
  defaultTitle: "DNMS - Run your entire company on one platform",
  description:
    "DNMS is an all-in-one company management platform: HR, biometric attendance, leave & WFH, payroll, performance, projects, recruitment, a client portal, SEO tools and team chat, all in one secure, permission-controlled system.",
  url:
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "https://dnms.digitallynext.com",
  contactEmail: "sales@digitallynext.com",

  /**
   * The public address as it is WRITTEN IN COPY.
   *
   * Deliberately a constant rather than `url` above. `url` follows
   * NEXT_PUBLIC_APP_URL so canonical tags, OpenGraph and the sitemap stay
   * correct per environment - which is exactly why it must not be used in prose:
   * it renders "http://localhost:3000" in development and would print that into
   * the privacy policy. A legal document has to name the real service whatever
   * machine happened to render it.
   */
  domain: "dnms.digitallynext.com",

  // ---------------------------------------------------------------------------
  // Legal identity. Used by the privacy policy, terms, cookie and refund pages,
  // and by the Organization structured data.
  //
  // ⚠ REPLACE THE PLACEHOLDERS BELOW WITH THE REGISTERED DETAILS BEFORE RELYING
  // ON THE LEGAL PAGES. They are wired through every legal document from here,
  // so correcting them in this one object corrects them everywhere at once.
  // ---------------------------------------------------------------------------
  legal: {
    /** Registered company name as it appears on incorporation documents. */
    entity: "Digitally Next",
    /** Registered office. Shown on every legal page and in the contact block. */
    address: "New Delhi, India",
    /** Courts with exclusive jurisdiction over disputes. */
    jurisdiction: "New Delhi, India",
    governingLaw: "the laws of India",
    // Company identifiers. `as string` because the object is `as const`: an
    // empty literal narrows to type `""`, and TypeScript then reads every
    // `{cin && ...}` guard as unreachable rather than as "not filled in yet".
    cin: "" as string,
    gstin: "" as string,
  },

  /** Inboxes referenced by the legal, contact and support surfaces. */
  emails: {
    sales: "sales@digitallynext.com",
    support: "support@digitallynext.com",
    privacy: "privacy@digitallynext.com",
    /** Grievance Officer, required by India's DPDP Act and the IT Rules. */
    grievance: "grievance@digitallynext.com",
  },

  /** Shown on the contact page. Empty strings are omitted from the UI. */
  contact: {
    /** `as string` for the same reason as the identifiers above. */
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
