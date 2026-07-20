"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ShieldCheck, Loader2, AlertTriangle, Pencil } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { apiFetch } from "@/lib/api-fetch"
import { cleanLeaveTypeForLetter } from "@/lib/utils"
import { MailSignature, type MailSignatureData } from "@/features/leave/components/mail-signature"

type Signature = MailSignatureData
interface PreviewData {
  autoApprove: boolean
  /** The manager the letter is addressed to (null when nobody is set up). */
  to: { name: string; email: string } | null
  /** The HR mailbox on CC, or null. */
  ccHr: string | null
  /** The applicant's email signature block (same source the real email uses). */
  signature: Signature | null
}

/**
 * A live, EDITABLE preview of the leave letter. The envelope (To/Cc/Subject) and
 * signature are structural and read-only; the letter body is a textarea the
 * employee can rewrite, and whatever it holds is exactly what gets emailed
 * (reported up via `onBodyChange`, sent verbatim by the server).
 */
export function LeaveMailPreview({
  leaveTypeName,
  startDate,
  endDate,
  totalDays,
  reason,
  applicantName,
  onBodyChange,
  onSubjectChange,
}: {
  leaveTypeName?: string
  startDate: string
  endDate: string
  totalDays: number
  reason: string
  applicantName: string
  /** Called with the current letter body (composed default, or the edited text). */
  onBodyChange?: (body: string) => void
  /** Called with the current subject line. */
  onSubjectChange?: (subject: string) => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["leave-apply-preview"],
    queryFn: () => apiFetch<{ data: PreviewData }>("/api/leave/apply/preview").then((r) => r.data),
    staleTime: 5 * 60_000,
  })

  const fmt = (d: string) => (d ? new Date(d).toDateString() : "-")
  const start = fmt(startDate)
  const end = fmt(endDate || startDate)
  const dateLine = !startDate ? "-" : start === end ? start : `${start} to ${end}`
  const managerFirst = data?.to?.name.split(" ")[0] ?? "Manager"

  // The default letter the employee starts from (matches renderLeaveRequestEmail).
  const composed = useMemo(() => {
    const type = cleanLeaveTypeForLetter(leaveTypeName)
    const days = `${totalDays || 0} day${totalDays === 1 ? "" : "s"}`
    const reasonLine =
      reason.trim() || "I have submitted this request in Digitally Next for your consideration."
    return [
      `Dear ${managerFirst},`,
      ``,
      `I would like to apply for ${type} for ${days}, from ${dateLine}.`,
      ``,
      reasonLine,
      ``,
      `I will ensure my responsibilities are handed over before I leave and can be reached if anything urgent comes up. Kindly approve the request at your convenience.`,
      ``,
      `Thank you for your consideration.`,
      ``,
      `Best Regards,`,
    ].join("\n")
  }, [managerFirst, leaveTypeName, totalDays, dateLine, reason])

  const composedSubject = `Leave application - ${applicantName} - ${dateLine}`

  const [body, setBody] = useState(composed)
  const [subject, setSubject] = useState(composedSubject)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // The form (reason, dates, type) always regenerates the letter, so a reason
  // edited AFTER touching the letter still flows in - manual letter tweaks simply
  // persist until the next form change. This is what fixes "typing in the reason
  // box stopped updating the letter".
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
        ) : data?.autoApprove ? (
          <div className="flex items-start gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              This request is <strong>approved automatically</strong> - no email is sent.
            </p>
          </div>
        ) : !data?.to ? (
          <div className="flex items-start gap-2 rounded border border-amber-400/40 bg-amber-500/10 p-3">
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
                exact text is what gets emailed. Border stays static (no focus
                highlight - the box already reads as an input). */}
            <div className="bg-background relative rounded-md border p-3">
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
