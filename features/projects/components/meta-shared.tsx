"use client"

import { TONE } from "@/lib/constants"

// lucide dropped its Facebook glyph (trademark), so use the brand mark inline.
export function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  )
}

export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN")
export const compact = (n: number) =>
  n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "K" : String(Math.round(n))

export const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  active: TONE.green,
  paused: TONE.amber,
  completed: TONE.neutral,
}

/** The ad platforms shown in the Integration tab. Only `meta` is live today. */
export interface ProviderMeta {
  id: string
  label: string
  color: string
  live: boolean
}
export const PROVIDERS: ProviderMeta[] = [
  { id: "meta", label: "Meta Ads", color: "#1877F2", live: true },
  { id: "google", label: "Google Ads", color: "#4285F4", live: false },
  { id: "shopify", label: "Shopify", color: "#96BF47", live: false },
]
