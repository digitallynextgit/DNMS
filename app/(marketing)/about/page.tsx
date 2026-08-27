import type { Metadata } from "next"

import { siteConfig } from "@/config/site"
import { AboutContent } from "@/features/marketing"

export const metadata: Metadata = {
  title: "About",
  description: `${siteConfig.fullName} is built by ${siteConfig.legal.entity}, an agency that built the operations platform it wanted and then opened it up.`,
  alternates: { canonical: "/about" },
}

export default function AboutPage() {
  return <AboutContent />
}
