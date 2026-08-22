"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2, AlertTriangle, Pencil } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { apiFetch } from "@/lib/api-fetch"
import { MailSignature, type MailSignatureData } from "@/components/shared/mail-signature"

interface PreviewData {
  /** The manager the letter is addressed to (null when nobody is set up). */
  to: { name: string; email: string } | null
  /** The HR mailbox on Cc, or null. */
  ccHr: string | null
  /** The applicant's email signature block (same source the real email uses). */
  signature: MailSignatureData | null
}

/**
 * A live, EDITABLE preview of the WFH letter - the twin of LeaveMailPreview.
 * The envelope (To/Cc) and signature are structural and read-only; the subject
 * and letter body are editable, and whatever they hold is exactly what gets
 * emailed (reported up via the callbacks, sent verbatim by the server).
 */
export function WfhMailPreview({
  date,
  reason,
  isEmergency,
  applicantName,
  onBodyChange,
  onSubjectChange,
}: {
  /** "yyyy-MM-dd" */
  date: string
  reason: string
  isEmergency: boolean
  applicantName: string
  /** Called with the current letter body (composed default, or the edited text). */
  onBodyChange?: (body: string) => void
  /** Called with the current subject line. */
  onSubjectChange?: (subject: string) => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["wfh-apply-preview"],
    queryFn: () => apiFetch<{ data: PreviewData }>("/api/wfh/apply/preview").then((r) => r.data),
    staleTime: 5 * 60_000,
  })

  // Parse as a plain local date - `new Date("2026-08-24")` is UTC midnight, which
  // renders as the previous day for anyone behind UTC.
  const dateLine = useMemo(() => {
    if (!date) return "-"
    const [y, m, d] = date.split("-").map(Number)
    if (!y || !m || !d) return "-"
    return new Date(y, m - 1, d).toDateString()
  }, [date])

  const managerFirst = data?.to?.name.split(" ")[0] ?? "Manager"

  // The default letter the employee starts from (matches renderWfhRequestEmail).
  const composed = useMemo(() => {
    const reasonLine =
      reason.trim() || "I have submitted this request in Digitally Next for your consideration."
    return [
      `Dear ${managerFirst},`,
      ``,
      `I would like to request permission to work from home on ${dateLine}.`,
      ``,
      reasonLine,
      ...(isEmergency
        ? [``, `As this is an emergency request, it needs both your approval and HR's sign-off.`]
        : []),
      ``,
      `I will be available online through working hours, reachable on call and chat, and will keep the day's deliverables on track. Kindly approve the request at your convenience.`,
      ``,
      `Thank you for your consideration.`,
      ``,
      `Best Regards,`,
    ].join("\n")
  }, [managerFirst, dateLine, reason, isEmergency])

  const composedSubject = `Work From Home request - ${applicantName} - ${dateLine}`

  const [body, setBody] = useState(composed)
  const [subject, setSubject] = useState(composedSubject)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // The form (date, reason, emergency) always regenerates the letter, so a reason
  // edited AFTER touching the letter still flows in - manual letter tweaks simply
  // persist until the next form change.
  useEffect(() => {
    setBody(composed)
    onBodyChange?.(composed)
  }, [composed, onBodyChange])

  useEffect(() => {
    setSubject(composedSubject)
    onSubjectChange?.(composedSubject)
  }, [composedSubject, onSubjectChange])

  // Grow the textarea to fit its content - no inner scrollbar, no drag handle.
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [body])

  return (
    <Card className="lg:sticky lg:top-4">
      <CardContent className="space-y-3 p-4">
        {isLoading ? (
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" /> Working out who this goes to…
          </p>
        ) : !data?.to ? (
          <div className="flex items-start gap-2 rounded-[2px] border border-amber-400/40 bg-amber-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              You don&apos;t have a reporting manager set, and no approver was found. Your request
              will still be submitted, but no email goes out - please tell HR.
            </p>
          </div>
        ) : (
          <>
            {/* Envelope. To/Cc are read-only; Subject is editable. A shared grid
                keeps all three VALUES aligned on the same left edge. */}
            <div className="space-y-1 border-b pb-2 text-[11px]">
              <div className="grid grid-cols-[3.25rem_1fr] items-center gap-1">
                <span className="text-muted-foreground">To:</span>
                <span className="truncate font-medium">
                  {data.to.name} &lt;{data.to.email}&gt;
                </span>
              </div>
              {data.ccHr && (
                <div className="grid grid-cols-[3.25rem_1fr] items-center gap-1">
                  <span className="text-muted-foreground">Cc:</span>
                  <span className="truncate font-medium">{data.ccHr}</span>
                </div>
              )}
              <div className="grid grid-cols-[3.25rem_1fr] items-center gap-1">
                <span className="text-muted-foreground">Subject:</span>
                {/* Dashed underline + pencil = clearly editable, but its text still
                    lines up with To/Cc (no box padding pushing it right). */}
                <div className="relative">
                  <input
                    value={subject}
                    onChange={(e) => {
                      setSubject(e.target.value)
                      onSubjectChange?.(e.target.value)
                    }}
                    aria-label="Email subject"
                    // Inline outline:none beats the global :focus-visible outline
                    // rule (unlayered CSS wins over Tailwind utilities).
                    style={{ outline: "none", boxShadow: "none" }}
                    className="border-muted-foreground/40 w-full appearance-none border-0 border-b border-dashed bg-transparent py-0.5 pr-5 text-[11px] font-medium focus:border-dashed"
                  />
                  <Pencil className="text-muted-foreground/50 pointer-events-none absolute top-1/2 right-0 h-3 w-3 -translate-y-1/2" />
                </div>
              </div>
            </div>

            {/* The letter - a distinct edit box so it's obviously editable. This
                exact text is what gets emailed. */}
            <div className="bg-background relative rounded-[2px] border p-3">
              <span className="text-muted-foreground/60 pointer-events-none absolute top-1.5 right-2 z-10 inline-flex items-center gap-0.5 text-[9px] font-medium tracking-wide uppercase">
                <Pencil className="h-2.5 w-2.5" /> Editable
              </span>
              {/* Plain textarea (NOT the shadcn one) so no default focus ring /
                  offset can draw a box. Full control over focus styling here. */}
              <textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value)
                  onBodyChange?.(e.target.value)
                }}
                rows={1}
                aria-label="Email message"
                // Inline outline:none beats the global :focus-visible outline
                // rule (unlayered CSS wins over Tailwind utilities).
                style={{ outline: "none", boxShadow: "none" }}
                className="text-foreground placeholder:text-muted-foreground w-full resize-none appearance-none overflow-hidden border-0 bg-transparent p-0 text-xs leading-relaxed"
              />
            </div>

            {/* Signature block (auto-appended, read-only). */}
            {data.signature && <MailSignature sig={data.signature} />}
          </>
        )}
      </CardContent>
    </Card>
  )
}
