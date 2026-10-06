"use client"

import { useEffect, useSyncExternalStore } from "react"
import { AUTH_HINT_COOKIE, appHomeFor, parseAuthHint } from "@/lib/auth-hint"

/**
 * Is a visitor to the PUBLIC marketing site signed in, and where is their app?
 * Shared by the header, the hero and the signup band.
 *
 * WHICH buttons show is decided by CSS, not by this hook: theme-boot.js stamps
 * <html data-auth> from the proxy's hint cookie before paint, and the
 * `auth-guest` / `auth-member` classes in globals.css follow it, so the static
 * HTML is right on its first frame (see lib/auth-hint.ts). This hook supplies
 * the app link (a portal contact's home is /portal), and re-stamps <html> after
 * a client-side navigation onto the marketing site, where theme-boot.js does
 * not run again.
 *
 * Not useSession(): the root layout gives SessionProvider `session={null}`,
 * which next-auth treats as a KNOWN signed-out session and never re-checks.
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
