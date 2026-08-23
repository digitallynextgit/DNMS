"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"

import { cn } from "@/lib/utils"
import { siteConfig } from "@/config/site"
import { Button } from "@/components/ui/button"

const NAV = [
  { href: "#platform", label: "Platform" },
  { href: "#modules", label: "Modules" },
  { href: "#security", label: "Security" },
  { href: "#faq", label: "FAQ" },
]

/** Dark/light only, wired to next-themes (the app's theme system). */
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = resolvedTheme === "dark"
  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="text-muted-foreground hover:text-foreground hover:bg-foreground/5 flex h-9 w-9 items-center justify-center rounded-[6px] transition-colors"
    >
      {/* Render nothing theme-specific until mounted to avoid hydration mismatch. */}
      {mounted ? (
        isDark ? (
          <Sun className="h-[1.05rem] w-[1.05rem]" />
        ) : (
          <Moon className="h-[1.05rem] w-[1.05rem]" />
        )
      ) : (
        <span className="h-[1.05rem] w-[1.05rem]" />
      )}
    </button>
  )
}

/**
 * Scroll-aware header: transparent over the hero, then gains a blurred
 * background + border once the page is scrolled. Logo left, links centered,
 * theme toggle + Login on the right.
 */
export function MarketingHeader() {
  const ref = useRef<HTMLElement>(null)
  const [scrolled, setScrolled] = useState(false)

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

  return (
    <header
      ref={ref}
      className={cn(
        // fixed (not sticky) so the hero sits BEHIND it and fills to the very top.
        "fixed inset-x-0 top-0 z-40 border-b transition-colors duration-300",
        scrolled
          ? "border-border/60 bg-background/80 supports-[backdrop-filter]:bg-background/55 backdrop-blur-xl"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto grid h-16 max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6">
        {/* Left: logo */}
        <Link
          href="/"
          className="flex items-center gap-2 justify-self-start"
          aria-label={siteConfig.name}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_white_bg.png" alt={siteConfig.name} className="h-11 w-auto dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo_dark_bg.webp"
            alt={siteConfig.name}
            className="hidden h-11 w-auto dark:block"
          />
        </Link>

        {/* Center: nav links */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="text-muted-foreground hover:text-foreground hover:bg-foreground/5 rounded-[6px] px-3 py-2 text-sm font-medium transition-colors"
            >
              {n.label}
            </a>
          ))}
        </nav>

        {/* Right: theme toggle + login */}
        <div className="flex items-center gap-1.5 justify-self-end sm:gap-2">
          <ThemeToggle />
          <Button asChild size="sm">
            <Link href={authed ? appHref : "/login"}>{authed ? "Dashboard" : "Log in"}</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
