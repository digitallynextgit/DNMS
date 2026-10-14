"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { RefreshCw, Smartphone, TriangleAlert } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { apiFetch } from "@/lib/api-fetch"

// -----------------------------------------------------------------------------
// /pair-phone - "sign the DNMS app in using the browser I am already signed in to."
//
// WHY THIS PAGE EXISTS. Most DNMS staff reached the web app through the Google
// provider and have never typed a DNMS password, and the app's own Google button
// needs Android/iOS OAuth client ids nobody has created yet. For those people
// this page is the ONLY way into the app, which is why it sits in the sidebar
// next to AI Connections rather than buried in settings.
//
// IT IS AUTHED BY ITS LAYOUT, not by anything here. app/(dashboard)/layout.tsx
// calls tenantScopedSession() and redirects to /login, and the proxy's page RBAC
// has no rule for this path, which means "any signed-in staff user" - correct,
// because the code it mints is only ever for its own caller. The API route behind
// it (/api/mobile/v1/auth/pair/start) authenticates INDEPENDENTLY with
// withSession(), and it has to: it lives under /api/mobile, a PUBLIC_PREFIX the
// Edge waves through. Nothing on this screen is the guard.
//
// THE CODE IS A LIVE CREDENTIAL FOR FIVE MINUTES, so the page treats it like one:
//  - nothing is minted until the person asks. A code that appears on page load
//    would also appear on a mis-click, on a prefetch and on a back-button
//    restore, and then sit on an unattended screen;
//  - the countdown is shown, so "is this still good?" is never a guess;
//  - it is never put in the URL, in localStorage or in a log - it exists in this
//    component's state and nowhere else, which is why "show it again" is a new
//    mint rather than a re-read;
//  - the response carries Cache-Control: no-store from the route.
// -----------------------------------------------------------------------------

type StartResponse = {
  data: {
    code: string
    expiresAt: string
    /** Seconds, from the SERVER's clock - see the note in `tick` below. */
    expiresIn: number
  }
}

/** "123456" -> "123 456". Two groups of three is what people read back accurately. */
function grouped(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`
}

function mmss(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

export function PairPhoneClient() {
  const [code, setCode] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The deadline the ticker reads, in a ref so the interval below can be started
  // once and never re-created when the code changes.
  const deadlineRef = useRef(0)

  const mint = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await apiFetch<StartResponse>("/api/mobile/v1/auth/pair/start", {
        method: "POST",
      })
      // expiresIn, NOT expiresAt minus Date.now(): expiresAt is the server's clock
      // and this is the browser's, and a laptop whose clock is ten minutes fast
      // would show a code that is already dead. A DURATION survives the skew; an
      // absolute instant does not.
      deadlineRef.current = Date.now() + res.data.expiresIn * 1000
      setCode(res.data.code)
      setSecondsLeft(res.data.expiresIn)
    } catch (err) {
      // The server's own sentence - 403 for an account that is no longer live
      // staff, 429 for someone reloading this a dozen times a minute.
      //
      // The CODE ON SCREEN IS LEFT ALONE on purpose. A 429 means mintPairCode()
      // never ran, so the code already shown is still live and still redeemable;
      // blanking it would throw away a working credential over a failed retry.
      // (A 403 means it is dead - but so is the account, and showing a stale code
      // is no worse than showing nothing.)
      setError(err instanceof Error ? err.message : "Could not create a code. Try again.")
    } finally {
      setBusy(false)
    }
  }, [])

  // One interval for the life of the page. It only reads the ref, so a new mint
  // does not restart it and the clock never skips a second on re-render.
  useEffect(() => {
    const id = setInterval(() => {
      if (!deadlineRef.current) return
      setSecondsLeft(Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000)))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const expired = code !== null && secondsLeft <= 0

  return (
    <div className="space-y-8">
      <PageHeader
        title="Pair Your Phone"
        description="Sign in to the DNMS mobile app using this browser - no password needed. Useful if you sign in to DNMS with Google and have never set a DNMS password."
      />

      <section className="bg-card max-w-xl space-y-5 rounded-lg border p-5">
        <div className="flex items-center gap-2">
          <Smartphone className="text-primary size-5" />
          <h2 className="font-semibold">Your pairing code</h2>
        </div>

        {code === null ? (
          <>
            <p className="text-muted-foreground text-sm">
              Open the DNMS app on your phone, tap{" "}
              <span className="text-foreground font-medium">Use a code from my laptop</span>, then
              create a code here and type it in. The code lasts five minutes and works once.
            </p>
            <Button onClick={mint} loading={busy}>
              Create a code
            </Button>
          </>
        ) : (
          <>
            {/* Tabular numerals so the digits do not shuffle sideways as the
                countdown ticks, and selectable because people do read it aloud. */}
            <div
              className="text-primary font-mono text-4xl font-semibold tracking-[0.14em] tabular-nums"
              // Digit by digit, or a screen reader says "one hundred twenty-three".
              aria-label={
                expired ? "Pairing code expired" : `Pairing code ${code.split("").join(" ")}`
              }
            >
              {expired ? "--- ---" : grouped(code)}
            </div>

            {expired ? (
              <p className="text-muted-foreground text-sm">
                That code has expired. Create another one and type it in straight away.
              </p>
            ) : (
              <p className="text-muted-foreground text-sm tabular-nums">
                Expires in {mmss(secondsLeft)}. Works once - creating a new code cancels this one.
              </p>
            )}

            <Button variant="outline" onClick={mint} loading={busy}>
              <RefreshCw className="size-4" />
              New code
            </Button>
          </>
        )}

        {error && (
          <p className="text-destructive flex items-start gap-2 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </section>

      <section className="text-muted-foreground max-w-xl space-y-2 text-sm">
        <h2 className="text-foreground font-semibold">What pairing does</h2>
        <p>
          The app gets its own sign-in for this device with exactly your DNMS permissions - nothing
          more. It does not copy this browser&apos;s session, and your password is never involved.
        </p>
        <p>
          Treat the code like a password for the five minutes it is alive: anyone who types it into
          a DNMS app signs in as you. Never send it in a message, and never read it out to someone
          who asked you for it.
        </p>
      </section>
    </div>
  )
}
