import type { Metadata } from "next"

import { LegalPage } from "@/features/marketing"
import { LEGAL_DOCS } from "@/features/marketing/legal.content"

const doc = LEGAL_DOCS.terms

export const metadata: Metadata = {
  title: doc.title,
  description: doc.summary,
  alternates: { canonical: "/legal/terms" },
}

export default function Page() {
  return <LegalPage doc={doc} />
}
