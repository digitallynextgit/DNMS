import type { Metadata } from "next"

import { LegalPage } from "@/features/marketing"
import { LEGAL_DOCS } from "@/features/marketing/legal.content"

// A real route per document rather than one [slug] segment. The dynamic version
// rendered the not-found BODY with a 200 status for an unknown slug - a soft
// 404, which invites crawlers to index garbage URLs. Four static routes let
// Next's own router answer that case correctly, and they prerender.
const doc = LEGAL_DOCS.refund

export const metadata: Metadata = {
  title: doc.title,
  description: doc.summary,
  alternates: { canonical: "/legal/refund" },
}

export default function Page() {
  return <LegalPage doc={doc} />
}
