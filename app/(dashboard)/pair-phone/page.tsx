import type { Metadata } from "next"
import { PairPhoneClient } from "@/features/auth"

export const metadata: Metadata = { title: "Pair Your Phone" }

// Open to all staff, like /ai-connections: the code this mints is only ever for its own caller, so
// there is nothing here one person could aim at another. Authed by (dashboard)/layout.tsx; the API
// route behind it re-authenticates on its own, because it sits under the public /api/mobile prefix.
export default function PairPhonePage() {
  return <PairPhoneClient />
}
