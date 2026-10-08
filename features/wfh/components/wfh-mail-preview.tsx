"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2, AlertTriangle, Pencil } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { apiFetch } from "@/lib/api-fetch"
import { MailSignature, type MailSignatureData } from "@/components/shared/mail-signature"

interface PreviewData {
  to: { name: string; email: string } | null
  ccHr: string | null
  signature: MailSignatureData | null
}

/** Editable WFH letter preview (twin of LeaveMailPreview); the subject and body are sent verbatim. */
export function WfhMailPreview({
  date,
  endDate,
  totalDays,
  reason,
  isEmergency,
  applicantName,
  onBodyChange,
  onSubjectChange,
}: {
  /** "yyyy-MM-dd" */
  date: string
  /** "yyyy-MM-dd"; equal to `date` for a single day. */
  endDate?: string
  totalDays?: number
  reason: string
  isEmergency: boolean
  applicantName: string
  onBodyChange?: (body: string) => void
  onSubjectChange?: (subject: string) => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["wfh-apply-preview"],
    queryFn: () => apiFetch<{ data: PreviewData }>("/api/wfh/apply/preview").then((r) => r.data),
    staleTime: 5 * 60_000,
  })

  // Parse as a local date: `new Date("2026-08-24")` is UTC midnight, the previous day behind UTC.
  const toLongDay = (value: string): string | null => {
    const [y, m, d] = value.split("-").map(Number)
    if (!y || !m || !d) return null
    return new Date(y, m - 1, d).toDateString()
  }

  // Mirrors renderWfhRequestEmail().
  const { dateLine, whenPhrase } = useMemo(() => {
    const start = date ? toLongDay(date) : null
    if (!start) return { dateLine: "-", whenPhrase: "on -" }

    const end = endDate && endDate !== date ? toLongDay(endDate) : null
    if (!end) return { dateLine: start, whenPhrase: `on ${start}` }

    const label = `${start} to ${end}`
    const note = totalDays && totalDays > 1 ? ` (${totalDays} working days)` : ""
    return { dateLine: label, whenPhrase: `from ${label}${note}` }
  }, [date, endDate, totalDays])

  const managerFirst = data?.to?.name.split(" ")[0] ?? "Manager"

  const composed = useMemo(() => {
    const reasonLine =
      reason.trim() || "I have submitted this request in Digitally Next for your consideration."
    const isRange = whenPhrase.startsWith("from ")
    const availability = isRange
      ? `I will be available online through working hours on each of these days, reachable on call and chat, and will keep my deliverables on track.`
      : `I will be available online through working hours, reachable on call and chat, and will keep the day's deliverables on track.`
    return [
      `Dear ${managerFirst},`,
      ``,
      `I would like to request permission to work from home ${whenPhrase}.`,
      ``,
      reasonLine,
      ...(isEmergency
        ? [``, `As this is an emergency request, it needs both your approval and HR's sign-off.`]
        : []),
      ``,
      `${availability} Kindly approve the request at your convenience.`,
      ``,
      `Thank you for your consideration.`,
      ``,
      `Best Regards,`,
    ].join("\n")
  }, [managerFirst, whenPhrase, reason, isEmergency])

  const composedSubject = `Work From Home request - ${applicantName} - ${dateLine}`

  const [body, setBody] = useState(composed)
  const [subject, setSubject] = useState(composedSubject)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // Form changes always regenerate the letter; manual tweaks last until the next form change.
  const [prevComposed, setPrevComposed] = useState(composed)
  if (composed !== prevComposed) {
    setPrevComposed(composed)
    setBody(composed)
  }
  const [prevSubject, setPrevSubject] = useState(composedSubject)
  if (composedSubject !== prevSubject) {
    setPrevSubject(composedSubject)
    setSubject(composedSubject)
  }

  useEffect(() => {
    onBodyChange?.(composed)
  }, [composed, onBodyChange])

  useEffect(() => {
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
          <div className="flex items-start gap-2 rounded-sm border border-amber-400/40 bg-amber-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              You don&apos;t have a reporting manager set, and no approver was found. Your request
              will still be submitted, but no email goes out - please tell HR.
            </p>
          </div>
        ) : (
          <>
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
                <div className="relative">
                  <input
                    value={subject}
                    onChange={(e) => {
                      setSubject(e.target.value)
                      onSubjectChange?.(e.target.value)
                    }}
                    aria-label="Email subject"
                    // Inline style beats the global :focus-visible outline (unlayered CSS wins over Tailwind).
                    style={{ outline: "none", boxShadow: "none" }}
                    className="border-muted-foreground/40 w-full appearance-none border-0 border-b border-dashed bg-transparent py-0.5 pr-5 text-[11px] font-medium focus:border-dashed"
                  />
                  <Pencil className="text-muted-foreground/50 pointer-events-none absolute top-1/2 right-0 h-3 w-3 -translate-y-1/2" />
                </div>
              </div>
            </div>

            <div className="bg-background relative rounded-sm border p-3">
              <span className="text-muted-foreground/60 pointer-events-none absolute top-1.5 right-2 z-10 inline-flex items-center gap-0.5 text-[9px] font-medium tracking-wide uppercase">
                <Pencil className="h-2.5 w-2.5" /> Editable
              </span>
              {/* Plain textarea, not the shadcn one, so no default focus ring draws a box. */}
              <textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value)
                  onBodyChange?.(e.target.value)
                }}
                rows={1}
                aria-label="Email message"
                style={{ outline: "none", boxShadow: "none" }}
                className="text-foreground placeholder:text-muted-foreground w-full resize-none appearance-none overflow-hidden border-0 bg-transparent p-0 text-xs leading-relaxed"
              />
            </div>

            {data.signature && <MailSignature sig={data.signature} />}
          </>
        )}
      </CardContent>
    </Card>
  )
}
