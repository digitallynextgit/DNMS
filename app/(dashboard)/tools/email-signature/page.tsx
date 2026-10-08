import type { Metadata } from "next"
import { EmailSignature } from "@/features/tools"

export const metadata: Metadata = {
  title: "Email Signature",
  description: "Your email signature in the company design, from your DNMS profile.",
}

export default function Page() {
  return <EmailSignature />
}
