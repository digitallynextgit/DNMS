import type { Metadata } from "next"
import dynamic from "next/dynamic"

import { siteConfig } from "@/lib/site"
import {
  Hero,
  MarqueeStrip,
  StatsBand,
  PlatformIntro,
  BentoOverview,
  SpotlightHr,
  SpotlightAttendance,
  SpotlightLeave,
  SpotlightProjects,
  SpotlightRecruitment,
  SpotlightComms,
  SpotlightSeo,
  HowItConnects,
  Benefits,
  WhyDnms,
  SecuritySection,
  Philosophy,
  Faq,
  SignupCta,
  Closing,
  StructuredData,
} from "@/features/marketing"

// Code-split so the framer runtime stays out of the homepage's first load (concrete modules,
// not the barrel). They still server-render; only their hydration JS arrives lazily.
const SpotlightPayroll = dynamic(() =>
  import("@/features/marketing/components/sections/spotlight-payroll").then(
    (m) => m.SpotlightPayroll,
  ),
)
const SpotlightClientPortal = dynamic(() =>
  import("@/features/marketing/components/sections/spotlight-client-portal").then(
    (m) => m.SpotlightClientPortal,
  ),
)

export const metadata: Metadata = {
  title: { absolute: siteConfig.defaultTitle },
  description: siteConfig.description,
  alternates: { canonical: "/" },
}

export default function HomePage() {
  return (
    <>
      <StructuredData />
      <Hero />
      <MarqueeStrip />
      <StatsBand />
      <PlatformIntro />
      {/* .dnms-below-fold applies content-visibility:auto, so sections aren't rendered until they near
          the viewport. Anchor jumps still work. */}
      {[
        BentoOverview,
        SpotlightHr,
        SpotlightAttendance,
        SpotlightLeave,
        SpotlightPayroll,
        SpotlightProjects,
        SpotlightRecruitment,
        SpotlightClientPortal,
        SpotlightComms,
        SpotlightSeo,
        HowItConnects,
        Benefits,
        WhyDnms,
        SecuritySection,
        Philosophy,
        Faq,
        SignupCta,
        Closing,
      ].map((Section, i) => (
        <div key={i} className="dnms-below-fold">
          <Section />
        </div>
      ))}
    </>
  )
}
