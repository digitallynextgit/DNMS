import type { Metadata } from "next"

import { LegalPage } from "@/features/marketing"
import { LEGAL_DOCS } from "@/features/marketing/legal.content"

const doc = LEGAL_DOCS.privacy

export const metadata: Metadata = {
  title: doc.title,
  description: doc.summary,
  alternates: { canonical: "/legal/privacy" },
}

export default function Page() {
  return <LegalPage doc={doc} />
}
