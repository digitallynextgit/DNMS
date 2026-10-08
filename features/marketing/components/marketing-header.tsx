"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Menu, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { siteConfig } from "@/lib/site"
import { Button } from "@/components/ui/button"
import { useMarketingSession } from "../hooks/use-marketing-session"

// Real pages, not in-page anchors - "#faq" from /about scrolls to nothing.
const NAV = [
  { href: "/about", label: "About us" },
  { href: "/contact", label: "Contact us" },
  // Pricing is hidden from the nav for now; the /pricing page is still live.
  { href: "/faq", label: "FAQ" },
]

/**
 * Scroll-aware header: transparent over the hero, solid once scrolled; a hamburger menu on mobile.
 */
export function MarketingHeader() {
  const ref = useRef<HTMLElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // Both button sets render; CSS picks one before first paint (see useMarketingSession).
  const { appHref } = useMarketingSession()

  useEffect(() => {
    // The marketing shell scrolls in its own container, so listen there, not on window.
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
        <Link
          href="/"
          className="flex items-center gap-2 justify-self-start"
          aria-label={siteConfig.name}
        >
          {/* Dark logo only - the marketing site is forced-dark. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo_dark_bg-96.webp"
            width={370}
            height={96}
            decoding="async"
            alt={siteConfig.name}
            className="h-9 w-auto sm:h-11"
          />
        </Link>

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

        <div className="flex items-center gap-1.5 justify-self-end sm:gap-2">
          <Button asChild className="auth-member hidden md:inline-flex">
            <Link href={appHref}>Dashboard</Link>
          </Button>
          {/* Quieter than the main CTA: most visitors don't have an account yet. */}
          <Button asChild variant="ghost" className="auth-guest hidden md:inline-flex">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild className="auth-guest hidden md:inline-flex">
            <Link href="/signup">Start free</Link>
          </Button>
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
            <Button asChild className="auth-member mt-2 w-full">
              <Link href={appHref} onClick={() => setMenuOpen(false)}>
                Dashboard
              </Link>
            </Button>
            <Button asChild className="auth-guest mt-2 w-full">
              <Link href="/signup" onClick={() => setMenuOpen(false)}>
                Start free
              </Link>
            </Button>
            <Button asChild variant="outline" className="auth-guest mt-1.5 w-full">
              <Link href="/login" onClick={() => setMenuOpen(false)}>
                Log in
              </Link>
            </Button>
          </nav>
        </div>
      )}
    </header>
  )
}
