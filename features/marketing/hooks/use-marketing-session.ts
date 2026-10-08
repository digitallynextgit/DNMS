"use client"

import { useEffect, useSyncExternalStore } from "react"
import { AUTH_HINT_COOKIE, appHomeFor, parseAuthHint } from "@/lib/auth-hint"

/**
 * Is a marketing-site visitor signed in, and where is their app? CSS picks which buttons show
 * (theme-boot.js stamps <html data-auth> before paint - see lib/auth-hint.ts); this hook supplies
 * the app link and re-stamps <html> after client-side navigation. Not useSession(): the root
 * layout passes session={null}, which next-auth never re-checks.
 */
export function useMarketingSession() {
  const hint = useSyncExternalStore(subscribeNever, readHint, () => null)

  useEffect(() => {
    // The LIVE cookie, not `hint`: during hydration `hint` is still the server
    // snapshot (null) and would wipe the attribute theme-boot.js just set.
    const live = readHint()
    const root = document.documentElement
    if (live) root.setAttribute("data-auth", live)
    else root.removeAttribute("data-auth")
  }, [hint])

  return { appHref: appHomeFor(hint) }
}

function readHint() {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${AUTH_HINT_COOKIE}=([^;]*)`))
  return parseAuthHint(match?.[1])
}

// The cookie only changes on a server response, which re-renders the page.
const subscribeNever = () => () => {}
