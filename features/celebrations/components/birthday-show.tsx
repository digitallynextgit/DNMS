"use client"

import dynamic from "next/dynamic"
import type { BirthdayShowProps } from "../types"

// Browser-only (WebGL, window size) and a chunk of its own, fetched only when it plays.
const BirthdayOverlay = dynamic(() => import("./birthday-overlay"), { ssr: false })

export function BirthdayShow({ shows }: { shows: BirthdayShowProps[] }) {
  return <BirthdayOverlay shows={shows} />
}
