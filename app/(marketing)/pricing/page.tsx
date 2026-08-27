import type { Metadata } from "next"

import { siteConfig } from "@/config/site"
import { PricingContent } from "@/features/marketing"

export const metadata: Metadata = {
  title: "Pricing",
  description: `${siteConfig.name} is priced per employee per month, with a 21-day trial and no card required.`,
  alternates: { canonical: "/pricing" },
}

export default function PricingPage() {
  return <PricingContent />
}
