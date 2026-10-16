"use client"

import * as React from "react"
import { Check, Copy, Eye, EyeOff, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { formatDate } from "@/lib/utils"
import { useIssueSheetIntake, useSheetIntake, type SheetIntake } from "../hooks/use-sheets"

// A tab's API: the link and secret an outside system (a website form) uses to add rows here.

/** Default A..Z column names and the auto-filled Date/Time are not fields the sender needs. */
function senderFields(columns: string[]): string[] {
  return columns.filter(
    (c) => !/^[A-Z]{1,2}$/.test(c) && !["date", "time"].includes(c.toLowerCase()),
  )
}

function exampleBody(fields: string[]): string {
  const sample = fields.length > 0 ? fields : ["Name", "Email", "Phone", "Message"]
  return JSON.stringify(
    {
      submittedAt: "2026-10-16T14:05:00+05:30",
      submissionId: "form-12345",
      fields: Object.fromEntries(sample.map((f) => [f, "..."])),
    },
    null,
    2,
  )
}

function developerGuide(intake: SheetIntake, fields: string[]): string {
  return [
    `DNMS calendar API - ${intake.workbookName} / ${intake.tabName}`,
    ``,
    `Send each form submission as one HTTPS POST from your server. Never call it from the browser:`,
    `the secret must stay private.`,
    ``,
    `URL: ${intake.url}`,
    `Headers:`,
    `  Authorization: Bearer ${intake.secret}`,
    `  Content-Type: application/json`,
    ``,
    `Body:`,
    exampleBody(fields),
    ``,
    `- fields: the form's values, keyed by column name. A name the tab doesn't have becomes a new column.`,
    `- submittedAt (optional): when the form was submitted, ISO 8601 with offset. It sets the Date and`,
    `  Time columns and the month the row is filed under. Default: when DNMS receives it.`,
    `- submissionId (optional, recommended): your unique id for the submission. A retry with the same id`,
    `  is not added twice.`,
    ``,
    `Replies (JSON):`,
    `  201 added: {"success":true,"data":{"calendar":"...","month":"2026-10","tab":"...","row":5}}`,
    `  200 already received (same submissionId): {"success":true,"data":{"duplicate":true,...}}`,
    `  401 wrong link or secret | 422 invalid row, see error.details | 429 too many, retry shortly`,
    `  5xx DNMS is having trouble: retry later`,
    ``,
    `Don't hold up the form or its email on this call: if it fails, queue it and retry.`,
  ].join("\n")
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = React.useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="shrink-0"
      aria-label={label}
      title={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } catch {
          toast.error("Couldn't copy - select the text and copy it by hand")
        }
      }}
    >
      {done ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  )
}

export function SheetApiDialog({
  open,
  onOpenChange,
  projectId,
  sheetId,
  tabName,
  columns,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  sheetId: string | null
  tabName: string
  /** The tab's column names, in order. */
  columns: string[]
}) {
  const { data: intake, isLoading } = useSheetIntake(projectId, open ? sheetId : null)
  const issue = useIssueSheetIntake(projectId, sheetId)
  const [showSecret, setShowSecret] = React.useState(false)
  const [confirmNew, setConfirmNew] = React.useState(false)
  const fields = senderFields(columns)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>API access · {tabName}</DialogTitle>
          <DialogDescription>
            Let another system, such as a website form, add rows to this tab. Each row is filed in
            the calendar for its month (DNMS starts that month if needed) with the Date and Time it
            was sent, and the calendar&apos;s owner is notified.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-9 rounded-sm" />
            <Skeleton className="h-9 rounded-sm" />
            <Skeleton className="h-32 rounded-sm" />
          </div>
        ) : !intake ? (
          <div className="border-border space-y-3 rounded-sm border border-dashed p-4 text-sm">
            <p className="text-muted-foreground">
              This tab has no API yet. Creating one gives it its own link and secret.
            </p>
            <Button onClick={() => issue.mutate()} disabled={issue.isPending || !sheetId}>
              {issue.isPending ? "Creating..." : "Create API link"}
            </Button>
          </div>
        ) : (
          <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>API link</Label>
              <div className="flex gap-2">
                <Input readOnly value={intake.url} className="font-mono text-xs" />
                <CopyButton text={intake.url} label="Copy the API link" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Secret</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  type={showSecret ? "text" : "password"}
                  value={intake.secret}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  aria-label={showSecret ? "Hide the secret" : "Show the secret"}
                  onClick={() => setShowSecret((s) => !s)}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <CopyButton text={intake.secret} label="Copy the secret" />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 gap-1.5"
                  onClick={() => setConfirmNew(true)}
                  disabled={issue.isPending}
                >
                  <RefreshCw className="h-3.5 w-3.5" /> New secret
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                {intake.rowsReceived} {intake.rowsReceived === 1 ? "row" : "rows"} received
                {intake.lastUsedAt ? ` · last on ${formatDate(intake.lastUsedAt)}` : ""}. Every tab
                has its own link and secret.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Fields to send</Label>
              {fields.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {fields.map((f) => (
                    <span key={f} className="bg-muted rounded-sm px-2 py-0.5 text-xs">
                      {f}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">
                  The tab has no named columns yet: the first row&apos;s field names become them.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Example request</Label>
              <pre className="bg-muted overflow-x-auto rounded-sm p-3 text-[11px] leading-relaxed">
                {`POST ${intake.url}\nAuthorization: Bearer <secret>\nContent-Type: application/json\n\n${exampleBody(fields)}`}
              </pre>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                className="gap-1.5"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(developerGuide(intake, fields))
                    toast.success("Developer guide copied, with the link and secret")
                  } catch {
                    toast.error("Couldn't copy the guide")
                  }
                }}
              >
                <Copy className="h-3.5 w-3.5" /> Copy developer guide
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      <ConfirmDialog
        open={confirmNew}
        onOpenChange={setConfirmNew}
        title="Replace the secret?"
        description="The current secret stops working at once. Whoever sends rows here (e.g. the website) must switch to the new one, or their rows will be refused."
        confirmLabel="Replace secret"
        variant="destructive"
        isLoading={issue.isPending}
        onConfirm={() => issue.mutate(undefined, { onSuccess: () => setConfirmNew(false) })}
      />
    </Dialog>
  )
}
