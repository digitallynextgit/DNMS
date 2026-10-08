"use client"

import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-fetch"
import type { MailSignatureData } from "@/components/shared/mail-signature"
import type { SignatureSource } from "../lib/signature"

/**
 * Read from GET /api/wfh/apply/preview, which builds the block from the same source as the email
 * template, so this can't drift from what DNMS mails. `null` without an employee record.
 */
export function useSignatureSource() {
  return useQuery({
    queryKey: ["tools", "email-signature", "source"],
    queryFn: async (): Promise<SignatureSource | null> => {
      const res = await apiFetch<{ data?: { signature?: MailSignatureData | null } }>(
        "/api/wfh/apply/preview",
      )
      const sig = res?.data?.signature
      if (!sig) return null
      return {
        ...sig,
        // The server builds it from NEXTAUTH_URL; if that's unset it comes back
        // relative - resolve it against this site so the preview still loads.
        logoUrl: sig.logoUrl ? new URL(sig.logoUrl, window.location.origin).href : null,
      }
    },
    staleTime: 5 * 60_000,
  })
}
