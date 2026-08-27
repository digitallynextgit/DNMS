import type { Metadata } from "next"

import { siteConfig } from "@/config/site"
import { FaqContent } from "@/features/marketing"
import { ALL_FAQS } from "@/features/marketing/faq.content"

export const metadata: Metadata = {
  title: "FAQ",
  description: `${ALL_FAQS.length} answers about how ${siteConfig.name} works: modules, biometric attendance, security, the client portal and pricing.`,
  alternates: { canonical: "/faq" },
}

export default function FaqPage() {
  return <FaqContent />
}
