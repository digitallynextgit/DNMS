import type { Metadata } from "next"

import { LegalPage } from "@/features/marketing"
import { LEGAL_DOCS } from "@/features/marketing/legal.content"

// A static route per document, not one [slug] segment, so an unknown slug gets a real 404.
const doc = LEGAL_DOCS.cookies

export const metadata: Metadata = {
  title: doc.title,
  description: doc.summary,
  alternates: { canonical: "/legal/cookies" },
}

export default function Page() {
  return <LegalPage doc={doc} />
}
