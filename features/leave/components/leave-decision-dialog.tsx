"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Sparkles, Loader2, Pencil } from "lucide-react"
import { toast } from "sonner"
import { Spinner } from "@/components/shared/spinner"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn, cleanLeaveTypeForLetter } from "@/lib/utils"
import { apiFetch } from "@/lib/api-fetch"
import { MailSignature, type MailSignatureData } from "@/features/leave/components/mail-signature"
import {
  useApproveLeave,
  useRejectLeave,
  type LeaveRequest,
} from "@/features/leave/hooks/use-leave"

interface Variant {
  label: string
  text: string
}

const fmtDate = (d: string) => new Date(d).toDateString()

/** The default reply letter - kept in sync with renderLeaveDecisionLetter on the
 *  server (that server default is only a fallback; whatever is in the box here is
 *  what actually gets sent). */
function composeBody(args: {
  approved: boolean
  firstName: string
  leaveTypeName: string
  startDate: string
  endDate: string
  totalDays: number
  reason: string
}): string {
  const { approved, firstName, leaveTypeName, startDate, endDate, totalDays, reason } = args
  const s = fmtDate(startDate)
  const e = fmtDate(endDate)
  const dates = s === e ? s : `${s} to ${e}`
  const type = cleanLeaveTypeForLetter(leaveTypeName)
  const days = `${totalDays} day${totalDays === 1 ? "" : "s"}`
  if (approved) {
    return [
      `Dear ${firstName},`,
      ``,
      `I am pleased to inform you that your application for ${type} for ${days}, from ${dates}, has been approved.`,
      ``,
      `Please ensure your responsibilities are handed over before you go. Do reach out if anything needs to be sorted beforehand.`,
      ``,
      `Best Regards,`,
    ].join("\n")
  }
  return [
    `Dear ${firstName},`,
    ``,
    `Thank you for your application for ${type} for ${days}, from ${dates}. After review, I am unable to approve it at this time.`,
    ``,
    ...(reason.trim() ? [`Reason: ${reason.trim()}`, ``] : []),
    `Please feel free to reach out if you would like to discuss this further.`,
    ``,
    `Best Regards,`,
  ].join("\n")
}

/**
 * Approve / reject a leave request. Shows the exact reply that will be emailed to
 * the employee (on the same thread they applied on): an editable letter, an
 * "Improve with AI" helper, and the approver's signature.
 */
export function LeaveDecisionDialog({
  open,
  onOpenChange,
  action,
  request,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: "APPROVE" | "REJECT"
  request: LeaveRequest | null
}) {
  const approveLeave = useApproveLeave()
  const rejectLeave = useRejectLeave()
  const isReject = action === "REJECT"

  const [reason, setReason] = React.useState("")
  const [body, setBody] = React.useState("")
  const [variants, setVariants] = React.useState<Variant[]>([])
  const [polishing, setPolishing] = React.useState(false)
  const bodyRef = React.useRef<HTMLTextAreaElement>(null)

  // The approver's signature (same source the sent email uses).
  const { data: sig } = useQuery({
    queryKey: ["leave-decision-signature"],
    queryFn: () =>
      apiFetch<{ data: { signature: MailSignatureData | null } }>(
        "/api/leave/decision/preview",
      ).then((r) => r.data.signature),
    staleTime: 5 * 60_000,
    enabled: open,
  })

  const firstName = request?.employee.firstName ?? ""
  const composed = React.useMemo(
    () =>
      request
        ? composeBody({
            approved: !isReject,
            firstName,
            leaveTypeName: request.leaveType.name,
            startDate: request.startDate,
            endDate: request.endDate,
            totalDays: request.totalDays,
            reason,
          })
        : "",
    [request, isReject, firstName, reason],
  )

  // Regenerate the letter whenever the form (reason) changes; manual edits persist
  // until the next such change - same behaviour as the apply screen.
  React.useEffect(() => {
    setBody(composed)
  }, [composed])

  // Reset when (re)opened.
  React.useEffect(() => {
    if (open) {
      setReason("")
      setVariants([])
    }
  }, [open, action])

  // Auto-grow the letter box.
  React.useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [body, open])

  if (!request) return null

  const isLoading = approveLeave.isPending || rejectLeave.isPending
  const disabled = isLoading || (isReject && reason.trim().length === 0)
  const employeeName = `${request.employee.firstName} ${request.employee.lastName}`.trim()
  const s = fmtDate(request.startDate)
  const e = fmtDate(request.endDate)
  const dates = s === e ? s : `${s} to ${e}`

  async function improveWithAI() {
    setPolishing(true)
    try {
      const res = await apiFetch<{ data: { variants: Variant[] } }>("/api/leave/decision/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: body, approved: !isReject }),
      })
      setVariants(res.data.variants ?? [])
      if (!res.data.variants?.length) toast.info("AI had no suggestions this time.")
    } catch {
      toast.error("Couldn't reach the AI. Your message is unchanged.")
    } finally {
      setPolishing(false)
    }
  }

  async function handleConfirm() {
    if (!request) return
    const emailBody = body.trim() || undefined
    if (isReject) {
      await rejectLeave.mutateAsync({ id: request.id, rejectionReason: reason.trim(), emailBody })
    } else {
      await approveLeave.mutateAsync({ id: request.id, emailBody })
    }
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-sm font-semibold tracking-tight">
            {isReject ? "Reject Leave Request" : "Approve Leave Request"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground text-sm">
            This reply is emailed to {request.employee.firstName} on the same thread they applied on.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isReject && (
          <div className="space-y-2">
            <Label htmlFor="leave-reject-reason" className="text-sm">
              Rejection Reason<span className="text-destructive"> *</span>
            </Label>
            <Textarea
              id="leave-reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this being declined? It goes into the letter below."
              rows={2}
            />
          </div>
        )}

        {/* The reply preview: envelope + editable letter + approver signature. */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs font-medium">Reply preview</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={improveWithAI}
              disabled={polishing || !body.trim()}
            >
              {polishing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Improve with AI
            </Button>
          </div>

          {variants.length > 0 && (
            <div className="space-y-1.5 rounded-md border p-2">
              <p className="text-muted-foreground text-[11px]">Pick a version:</p>
              <div className="flex flex-wrap gap-1.5">
                {variants.map((v) => (
                  <button
                    key={v.label}
                    type="button"
                    onClick={() => {
                      setBody(v.text)
                      setVariants([])
                    }}
                    className="hover:bg-accent rounded border px-2 py-1 text-[11px] font-medium"
                    title={v.text}
                  >
                    {v.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setVariants([])}
                  className="text-muted-foreground px-2 py-1 text-[11px]"
                >
                  Keep mine
                </button>
              </div>
            </div>
          )}

          <div className="bg-background rounded-md border">
            {/* Envelope */}
            <div className="space-y-1 border-b p-3 text-[11px]">
              <div className="grid grid-cols-[3.5rem_1fr] gap-1">
                <span className="text-muted-foreground">To:</span>
                <span className="truncate font-medium">{employeeName}</span>
              </div>
              <div className="grid grid-cols-[3.5rem_1fr] gap-1">
                <span className="text-muted-foreground">Subject:</span>
                <span className="truncate font-medium">
                  Re: Leave application - {employeeName} - {dates}
                </span>
              </div>
            </div>

            {/* Editable letter */}
            <div className="relative p-3">
              <span className="text-muted-foreground/60 pointer-events-none absolute top-1.5 right-2 z-10 inline-flex items-center gap-0.5 text-[9px] font-medium tracking-wide uppercase">
                <Pencil className="h-2.5 w-2.5" /> Editable
              </span>
              <textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={1}
                aria-label="Reply message"
                style={{ outline: "none", boxShadow: "none" }}
                className="text-foreground w-full resize-none appearance-none overflow-hidden border-0 bg-transparent p-0 text-xs leading-relaxed"
              />
              {sig && <MailSignature sig={sig} />}
            </div>
          </div>
          <p className="text-muted-foreground text-[11px]">HR is copied on this reply.</p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading} className="text-sm">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              void handleConfirm()
            }}
            disabled={disabled}
            className={cn(isReject && buttonVariants({ variant: "destructive" }))}
          >
            {isLoading && <Spinner size="sm" className="mr-2" />}
            {isReject ? "Reject & Send" : "Approve & Send"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
