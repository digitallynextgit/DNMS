import type { Metadata } from "next"
import dynamic from "next/dynamic"

import { siteConfig } from "@/config/site"
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

// The two sections that import motion/react, code-split out of the page's
// initial chunk (concrete modules, never the barrel - the barrel would pull
// the whole feature back in). They still server-render; only their hydration
// JS arrives lazily. This keeps the framer runtime out of the homepage's
// first load entirely (the hero's mockup is split the same way inside Hero).
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
      {/* Everything below is at least a viewport down. .dnms-below-fold applies
          content-visibility:auto per section, so the browser skips rendering
          and painting each one (including its decorative animations) until it
          nears the viewport. Anchor jumps (#modules lives in BentoOverview)
          still work - browsers render a content-visibility target on anchor
          navigation. */}
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
