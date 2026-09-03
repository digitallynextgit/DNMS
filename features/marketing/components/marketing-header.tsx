"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { Menu, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { siteConfig } from "@/config/site"
import { Button } from "@/components/ui/button"

// Real pages, not in-page anchors.
//
// The old nav was four homepage anchors, which silently stopped working the
// moment there were other pages: "#faq" from /about scrolls to nothing. Every
// entry is now a real page, so none of them depend on where you happen to be.
const NAV = [
  { href: "/about", label: "About us" },
  { href: "/contact", label: "Contact us" },
  // Temporarily hidden from the nav. The /pricing page itself is still live
  // and still linked from the footer and the sitemap - this only takes it out
  // of the header. Uncomment to put it back.
  // { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
]

/** Dark/light only, wired to next-themes (the app's theme system). */
// NOTE: the theme toggle used to live here. The marketing site is dark-only
// now - Providers pins forcedTheme="dark" for these routes - so a control that
// appeared to do nothing has been removed rather than left to confuse people.

/**
 * Scroll-aware header: transparent over the hero, then gains a blurred
 * background + border once scrolled. Logo left, links centered (desktop),
 * theme toggle + Login on the right; a hamburger menu on mobile.
 */
export function MarketingHeader() {
  const ref = useRef<HTMLElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // Already signed in? Send them straight to their app instead of the login page.
  const { data: session } = useSession()
  const authed = !!session?.user
  const appHref = session?.user?.kind === "client" ? "/portal" : "/dashboard"

  useEffect(() => {
    // The marketing shell scrolls in its own container (globals.css pins the
    // body), so listen to the header's scroll parent, not window.
    const scroller = ref.current?.parentElement
    if (!scroller) return
    const onScroll = () => setScrolled(scroller.scrollTop > 8)
    onScroll()
    scroller.addEventListener("scroll", onScroll, { passive: true })
    return () => scroller.removeEventListener("scroll", onScroll)
  }, [])

  const solid = scrolled || menuOpen

  return (
    <header
      ref={ref}
      className={cn(
        // fixed (not sticky) so the hero sits BEHIND it and fills to the very top.
        "fixed inset-x-0 top-0 z-40 border-b transition-colors duration-300",
        solid
          ? "border-border/60 bg-background/80 supports-[backdrop-filter]:bg-background/55 backdrop-blur-xl"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6 md:grid md:grid-cols-[1fr_auto_1fr]">
        {/* Left: logo */}
        <Link
          href="/"
          className="flex items-center gap-2 justify-self-start"
          aria-label={siteConfig.name}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo_white_bg-96.png"
            width={370}
            height={96}
            decoding="async"
            alt={siteConfig.name}
            className="h-9 w-auto sm:h-11 dark:hidden"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo_dark_bg-96.webp"
            width={370}
            height={96}
            decoding="async"
            alt={siteConfig.name}
            className="hidden h-9 w-auto sm:h-11 dark:block"
          />
        </Link>

        {/* Center: nav links (desktop) */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="text-muted-foreground hover:text-foreground hover:bg-foreground/5 rounded-sm px-3 py-2 text-sm font-medium transition-colors"
            >
              {n.label}
            </a>
          ))}
        </nav>

        {/* Right: theme toggle + login (desktop) + hamburger (mobile) */}
        <div className="flex items-center gap-1.5 justify-self-end sm:gap-2">
          {authed ? (
            <Button asChild size="sm" className="hidden md:inline-flex">
              <Link href={appHref}>Dashboard</Link>
            </Button>
          ) : (
            <>
              {/* Log in is the quieter of the two: most people arriving on the
                  marketing page do not have an account yet. */}
              <Button asChild size="sm" variant="ghost" className="hidden md:inline-flex">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild size="sm" className="hidden md:inline-flex">
                <Link href="/signup">Start free</Link>
              </Button>
            </>
          )}
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="text-muted-foreground hover:text-foreground hover:bg-foreground/5 flex h-9 w-9 items-center justify-center rounded-sm transition-colors md:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      {menuOpen && (
        <div className="border-border/60 bg-background/95 supports-[backdrop-filter]:bg-background/85 border-t backdrop-blur-xl md:hidden">
          <nav className="mx-auto flex max-w-[1600px] flex-col gap-0.5 px-4 py-3 sm:px-6">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setMenuOpen(false)}
                className="text-muted-foreground hover:text-foreground hover:bg-foreground/5 rounded-sm px-3 py-2.5 text-sm font-medium transition-colors"
              >
                {n.label}
              </a>
            ))}
            {authed ? (
              <Button asChild size="sm" className="mt-2 w-full">
                <Link href={appHref} onClick={() => setMenuOpen(false)}>
                  Dashboard
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild size="sm" className="mt-2 w-full">
                  <Link href="/signup" onClick={() => setMenuOpen(false)}>
                    Start free
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="mt-1.5 w-full">
                  <Link href="/login" onClick={() => setMenuOpen(false)}>
                    Log in
                  </Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
