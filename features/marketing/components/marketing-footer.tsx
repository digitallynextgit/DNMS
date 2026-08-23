import Link from "next/link"

import { siteConfig } from "@/config/site"

// Brand red (matches the hero accent + the logo mark).
const BRAND_RED = "#ef4444"

interface FooterLinkItem {
  href: string
  label: string
}
interface FooterColumn {
  title: string
  links: FooterLinkItem[]
}

const COLUMNS: FooterColumn[] = [
  {
    title: "Explore",
    links: [
      { href: "#platform", label: "Platform" },
      { href: "#modules", label: "Modules" },
      { href: "#benefits", label: "Benefits" },
    ],
  },
  {
    title: "Trust & help",
    links: [
      { href: "#security", label: "Security" },
      { href: "#faq", label: "FAQ" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "https://digitallynext.com", label: "Digitally Next" },
      { href: `mailto:${siteConfig.contactEmail}`, label: "Contact" },
      { href: "/login", label: "Log in" },
    ],
  },
]

function FooterLink({ href, label }: FooterLinkItem) {
  const cls = "text-muted-foreground hover:text-foreground transition-colors"
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={cls}>
        {label}
      </Link>
    )
  }
  const external = href.startsWith("http")
  return (
    <a
      href={href}
      className={cls}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {label}
    </a>
  )
}

/** Informational footer: brand blurb + grouped link columns. */
export function MarketingFooter() {
  return (
    <footer className="border-border/60 relative border-t">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-10 px-4 py-12 lg:flex-row lg:items-start lg:justify-between lg:px-6">
        {/* Brand */}
        <div className="max-w-sm">
          <Link href="/" className="inline-flex items-center gap-2" aria-label={siteConfig.name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo_white_bg.png"
              alt={siteConfig.name}
              className="h-10 w-auto sm:h-11 dark:hidden"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo_dark_bg.webp"
              alt={siteConfig.name}
              className="hidden h-10 w-auto sm:h-11 dark:block"
            />
          </Link>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            The all-in-one platform to run your entire company: HR, attendance, payroll, projects,
            hiring, a client portal and more, in one secure login.
          </p>
          <p className="text-muted-foreground mt-4 text-xs">
            Powered by{" "}
            <a
              href="https://digitallynext.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold transition-opacity hover:opacity-80"
              style={{ color: BRAND_RED }}
            >
              Digitally Next
            </a>
          </p>
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:gap-16">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-foreground text-xs font-semibold tracking-wide uppercase">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <FooterLink {...l} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-border/60 text-muted-foreground border-t py-5 text-center text-xs">
        © {new Date().getFullYear()} {siteConfig.company}. All rights reserved.
      </div>
    </footer>
  )
}
