import type { Metadata } from "next"

import { siteConfig } from "@/config/site"
import { ContactContent } from "@/features/marketing"

export const metadata: Metadata = {
  title: "Contact",
  description: `Talk to the ${siteConfig.name} team about demos, pricing, support or a data request.`,
  alternates: { canonical: "/contact" },
}

export default function ContactPage() {
  return <ContactContent />
}
