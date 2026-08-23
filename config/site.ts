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
