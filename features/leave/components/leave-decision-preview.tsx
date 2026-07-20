"use client"

/**
 * A faithful preview of the approve/reject email the employee will receive
 * (mirrors renderDecisionEmail on the server). Threaded replies reuse the
 * original application subject, so the subject reads "Re: Leave application …".
 */
export function LeaveDecisionPreview({
  employeeName,
  firstName,
  leaveTypeName,
  startDate,
  endDate,
  totalDays,
  approved,
  reason,
}: {
  employeeName: string
  firstName: string
  leaveTypeName: string
  startDate: string
  endDate: string
  totalDays: number
  approved: boolean
  reason?: string
}) {
  // toDateString() to match the server's subject/detail formatting exactly.
  const fmt = (d: string) => new Date(d).toDateString()
  const start = fmt(startDate)
  const end = fmt(endDate)
  const dates = start === end ? start : `${start} – ${end}`
  const dayLabel = `${totalDays} day${totalDays === 1 ? "" : "s"}`
  const detailLine = `${leaveTypeName} · ${dates} (${dayLabel})`
  const verb = approved ? "approved" : "rejected"

  return (
    <div className="bg-background overflow-hidden rounded-md border">
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

      {/* Body */}
      <div className="space-y-2 p-3 text-xs">
        <p className={`text-sm font-semibold ${approved ? "text-green-600" : "text-destructive"}`}>
          Leave request {verb}
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Hi {firstName}, your leave request has been{" "}
          <strong className="text-foreground">{verb}</strong>.
        </p>
        <p className="text-foreground">{detailLine}</p>
        {!approved && reason?.trim() && (
          <p className="text-muted-foreground">
            <strong className="text-foreground">Reason:</strong> {reason.trim()}
          </p>
        )}
      </div>
    </div>
  )
}
