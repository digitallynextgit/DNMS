"use client"

import { useState } from "react"
import { CalendarClock, XCircle } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useMyResignation } from "../hooks/use-resignations"

/** A decline stays on the profile this long; after that the reviewer's note is old news. */
const DECLINE_SHOWN_DAYS = 30

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })

/**
 * The decision on your latest resignation, on your own profile: the notice period and last
 * working day once it is accepted, or who declined it and why.
 */
export function ResignationNotice() {
  const { data: r } = useMyResignation()
  const [now] = useState(() => Date.now())

  if (!r?.reviewedAt || (r.status !== "APPROVED" && r.status !== "REJECTED")) return null
  const approved = r.status === "APPROVED"
  if (!approved && now - new Date(r.reviewedAt).getTime() > DECLINE_SHOWN_DAYS * 86_400_000)
    return null

  const by = r.reviewer ? ` by ${`${r.reviewer.firstName} ${r.reviewer.lastName}`.trim()}` : ""
  const lastDay = r.employee.lastWorkingDate ?? r.requestedLastWorkingDate
  const Icon = approved ? CalendarClock : XCircle

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-sm",
              approved
                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400",
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
              {approved ? "Resignation accepted" : "Resignation declined"}
            </p>
            {approved ? (
              <p className="text-sm">
                You are serving your notice period
                {lastDay ? (
                  <>
                    {" "}
                    - your last working day is <span className="font-medium">{day(lastDay)}</span>
                  </>
                ) : null}
                . You keep full access until then, and your exit clearance has started.
              </p>
            ) : (
              <p className="text-sm">
                Your resignation of {day(r.createdAt)} was not accepted. Talk to your manager or HR
                if you have questions, or apply again from the button above.
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              {approved ? "Accepted" : "Declined"}
              {by} on {day(r.reviewedAt)}
            </p>
            {r.reviewNote ? (
              <p className="bg-muted/50 mt-2 rounded-sm px-3 py-2 text-sm whitespace-pre-line">
                {r.reviewNote}
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
