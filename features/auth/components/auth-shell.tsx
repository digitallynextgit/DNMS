import Link from "next/link"
import Image from "next/image"
import { Check } from "lucide-react"

// Brand red (matches the hero accent + the logo mark).
const BRAND_RED = "#ef4444"

const HIGHLIGHTS = [
  "People, departments & org chart",
  "Projects, tasks & timesheets",
  "Payroll, leave & performance",
]

/**
 * Two-column auth layout shared by the login and forgot-password pages: a
 * branded panel on the left (desktop only) and a centred form column on the
 * right. Page-specific content (heading + form) is supplied via `children`.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* ── Brand panel (desktop only) - content hugs the divider ────────── */}
      <div className="relative hidden overflow-hidden border-r border-white/10 bg-neutral-950 p-12 text-neutral-300 lg:flex lg:flex-col lg:items-center lg:justify-between xl:p-16">
        {/* decorative grid */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at center, black 20%, transparent 82%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 20%, transparent 82%)",
          }}
        />
        {/* logo */}
        <div className="relative z-10 w-full max-w-xl">
          <Link href="/" aria-label="Digitally Next home" className="inline-block">
            <Image
              src="/logo_dark_bg.webp"
              alt="Digitally Next"
              width={4500}
              height={1167}
              priority
              className="h-12 w-auto"
            />
          </Link>
        </div>

        {/* value proposition */}
        <div className="relative z-10 w-full max-w-xl space-y-6 py-4">
          <h2
            className="animate-dnms-fade-up text-4xl font-bold tracking-tight text-balance text-white sm:text-5xl"
            style={{ animationDelay: "0.15s" }}
          >
            Run your entire team from <span style={{ color: BRAND_RED }}>one place.</span>
          </h2>
          <p
            className="animate-dnms-fade-up text-lg leading-relaxed text-pretty text-neutral-400 lg:text-xl"
            style={{ animationDelay: "0.25s" }}
          >
            Digitally Next Management System unifies HR, projects, payroll and performance - so
            everything your people need lives in a single workspace.
          </p>
          <ul className="space-y-2.5 pt-1">
            {HIGHLIGHTS.map((item, i) => (
              <li
                key={item}
                className="animate-dnms-fade-up flex items-center gap-3 text-sm text-neutral-300"
                style={{ animationDelay: `${0.35 + i * 0.1}s` }}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] bg-emerald-500/15 ring-1 ring-emerald-500/25">
                  <Check className="h-3 w-3 text-emerald-500" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* footer */}
        <div className="relative z-10 w-full max-w-xl space-y-5">
          <p className="text-xs text-neutral-500">
            © 2026{" "}
            <a
              href="https://digitallynext.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium transition-opacity hover:opacity-80"
              style={{ color: BRAND_RED }}
            >
              Digitally Next
            </a>
            . All rights reserved.
          </p>
        </div>
      </div>

      {/* ── Form panel - content hugs the divider ───────────────────────── */}
      <div className="flex items-center justify-center px-6 py-10 lg:px-12">
        <div className="animate-dnms-fade-up w-full max-w-md">
          {/* logo - mobile only (swaps with theme) */}
          <div className="mb-8 flex justify-center lg:hidden">
            <Link href="/" aria-label="Digitally Next home" className="inline-flex">
              <Image
                src="/logo_white_bg.png"
                alt="Digitally Next"
                width={4500}
                height={1167}
                priority
                className="h-9 w-auto dark:hidden"
              />
              <Image
                src="/logo_dark_bg.webp"
                alt="Digitally Next"
                width={4500}
                height={1167}
                priority
                className="hidden h-9 w-auto dark:block"
              />
            </Link>
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}
