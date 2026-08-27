import type { Metadata } from "next"

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
  StructuredData,
} from "@/features/marketing"

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
      <BentoOverview />
      <SpotlightHr />
      <SpotlightAttendance />
      <SpotlightLeave />
      <SpotlightPayroll />
      <SpotlightProjects />
      <SpotlightRecruitment />
      <SpotlightClientPortal />
      <SpotlightComms />
      <SpotlightSeo />
      <HowItConnects />
      <Benefits />
      <WhyDnms />
      <SecuritySection />
      <Philosophy />
      <Faq />
      <SignupCta />
      <Closing />
    </>
  )
}
