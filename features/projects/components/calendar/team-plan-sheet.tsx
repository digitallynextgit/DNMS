"use client"

import * as React from "react"
import { toast } from "sonner"
import { CalendarDays, FileText, Plus, Trash2, TriangleAlert, Upload, X } from "lucide-react"

import { cn, formatFileSize } from "@/lib/utils"
import { apiFetch } from "@/lib/api-fetch"
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/upload-rules"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DateField } from "@/components/shared/date-field"
import { TaskResources } from "../task-resources"
import { dueLabel, dueTone, formatMonth, type DueTone } from "../../lib/calendar-months"
import {
  isOutstanding,
  statusProblem,
  STATUS_HINT,
  STATUS_LABEL,
  teamProgress,
  WORKBOOK_TEAM_STATUSES,
  type TeamProgress,
  type WorkbookTeamStatus,
} from "../../lib/workbook-team-progress"
import { sortProjectTeams } from "../../lib/project-teams"
import type { StaffWorkbook, WorkbookTeam } from "../../lib/sheet-types"
import type { ProjectTeam } from "../../hooks/use-projects"
import { MemberAvatars } from "./person-bits"
import { TeamPeopleDialog } from "./team-people-dialog"

// =============================================================================
// Editing what each team owes for one month.
//
// A right-side Sheet rather than an inline panel: the strip above the grid is
// for READING and must stay one line tall, and six teams of form fields would
// push the spreadsheet off the screen.
//
// ── WIDTH: USE THE SPACING SCALE, NOT max-w-2xl ──────────────────────────────
// app/globals.css redefines --container-2xl to 1400px, so `sm:max-w-2xl` is not
// Tailwind's 672px here - it is very nearly the whole screen, which is exactly
// what this panel first shipped as. `max-w-180` reads off the SPACING scale
// (180 × 0.25rem = 45rem = 720px) and so cannot be moved by a container
// override. task-detail-sheet.tsx uses max-w-120 for the same reason.
//
// ── TWO PERMISSIONS, NOT ONE ─────────────────────────────────────────────────
//   canPlan     - the account manager, the calendar's manager, or a team's own
//                 manager: who is on the row, how many, by when.
//   contribute  - anybody on that team: LINKS and FILES on their own row.
//
// The second is the point of putting the plan here at all. An employee who
// reads "DESIGN owes 12 by the 19th" and then has to walk to the Files tab to
// hand the work in is an employee who does not hand the work in.
// =============================================================================

const TONE_CLASS: Record<DueTone, string> = {
  overdue: "text-destructive",
  today: "text-amber-600 dark:text-amber-500",
  soon: "text-amber-600 dark:text-amber-500",
  later: "text-muted-foreground",
  none: "text-muted-foreground/60",
}

/**
 * Status colour. Muted for the states that are simply "in flight" - only the
 * two that mean somebody has to DO something carry a colour, or the panel turns
 * into a traffic light and none of it reads.
 */
const STATUS_CLASS: Record<WorkbookTeamStatus, string> = {
  TODO: "text-muted-foreground",
  IN_PROGRESS: "text-sky-600 dark:text-sky-400",
  DONE: "text-emerald-600 dark:text-emerald-400",
  STUCK: "text-destructive",
  DISCARDED: "text-muted-foreground/60 line-through",
}

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const handedInTitle = (p: TeamProgress) =>
  `${p.handedIn} link${p.handedIn === 1 ? "" : "s"} and files handed in, of ${p.quantity} promised`

/**
 * The status of one team's month.
 *
 * A Select for anyone on the team, plain text for everyone else. DONE is
 * offered but DISABLED while the row is short of its quantity, rather than
 * hidden: "why can't I finish this" is a question the list should answer
 * itself, and a missing option answers nothing.
 */
function StatusControl({
  status,
  progress,
  canEdit,
  canDiscard,
  pending,
  onChange,
}: {
  status: WorkbookTeamStatus
  progress: TeamProgress
  canEdit: boolean
  /** Dropping the work is a planning decision, not a progress report. */
  canDiscard: boolean
  pending: boolean
  onChange: (status: WorkbookTeamStatus) => void
}) {
  if (!canEdit) {
    return (
      <span className={cn("text-xs font-medium", STATUS_CLASS[status])}>
        {STATUS_LABEL[status]}
      </span>
    )
  }

  return (
    <Select
      value={status}
      disabled={pending}
      onValueChange={(v) => onChange(v as WorkbookTeamStatus)}
    >
      <SelectTrigger
        className={cn(
          "hover:bg-foreground/5 h-6 w-auto gap-1 border-transparent bg-transparent px-1.5 text-xs font-medium",
          STATUS_CLASS[status],
        )}
        aria-label="Status"
      >
        {STATUS_LABEL[status]}
      </SelectTrigger>
      <SelectContent align="end">
        {WORKBOOK_TEAM_STATUSES.filter((s) => s !== "DISCARDED" || canDiscard).map((s) => {
          const problem = statusProblem(s, progress)
          return (
            <SelectItem key={s} value={s} disabled={problem !== null}>
              <span className="flex flex-col items-start">
                <span className={cn("text-xs font-medium", STATUS_CLASS[s])}>
                  {STATUS_LABEL[s]}
                </span>
                <span className="text-muted-foreground text-[10px]">
                  {problem ?? STATUS_HINT[s]}
                </span>
              </span>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

/** One labelled row inside a team card. Keeps every label column the same width. */
function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-start gap-3 px-3 py-2", className)}>
      <span className="text-muted-foreground w-14 shrink-0 pt-1.5 text-[11px] font-medium">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export interface TeamPlanSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  workbook: StaffWorkbook
  /** All the project's teams, for the "not on the plan" row. */
  projectTeams: ProjectTeam[]
  /** May edit ANY team's row (account manager, admin, calendar manager). */
  canPlanAll: boolean
  /** The team this person manages, if any - they may edit that row alone. */
  managedTeamId: string | null
  /** The team this person is ON, if exactly one: links and files only. */
  myTeamId: string | null
  focusTeamId: string | null
  onSave: (input: {
    teamId: string
    quantity?: number | null
    dueOn?: string | null
    links?: string[]
    notes?: string | null
    employeeIds?: string[]
    status?: WorkbookTeamStatus
  }) => void
  onRemove: (teamId: string) => void
  pending: boolean
  /** Re-read the calendar after an upload or a detach. */
  onFilesChanged: () => void
}

export function TeamPlanSheet(props: TeamPlanSheetProps) {
  const { open, onOpenChange, workbook, projectTeams, canPlanAll, managedTeamId, focusTeamId } =
    props

  const onPlan = React.useMemo(() => new Set(workbook.teams.map((t) => t.teamId)), [workbook.teams])

  /**
   * Teams this viewer may put on the plan - which is NOT simply "the ones not
   * on it". A team manager may add their OWN team and nobody else's, the same
   * rule the server applies per row.
   */
  const canAdd = React.useMemo(() => {
    const free = projectTeams.filter((t) => !onPlan.has(t.id))
    return sortProjectTeams(canPlanAll ? free : free.filter((t) => t.id === managedTeamId))
  }, [projectTeams, onPlan, canPlanAll, managedTeamId])

  const today = React.useMemo(() => localToday(), [])
  const overdue = workbook.teams.filter(
    (t) => dueTone(t.dueOn, workbook.periodMonth, today) === "overdue",
  ).length
  const units = workbook.teams.reduce((n, t) => n + t.quantity, 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden border-l p-0 sm:max-w-180">
        {/* Header. pr-12 leaves room for the close button Radix parks top-right. */}
        <div className="bg-muted/30 space-y-2 border-b px-5 pt-4 pr-12 pb-3">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-base leading-none font-semibold tracking-tight">
              Team plan
            </SheetTitle>
            <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px] font-medium">
              <CalendarDays className="h-2.5 w-2.5" />
              {formatMonth(workbook.periodMonth)}
            </Badge>
          </div>

          <SheetDescription className="text-xs">
            {workbook.name}
            {workbook.assignedTo &&
              ` · managed by ${workbook.assignedTo.firstName} ${workbook.assignedTo.lastName}`}
          </SheetDescription>

          {/* The three numbers worth knowing before reading a single row. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            <span className="text-muted-foreground">
              <span className="text-foreground font-medium tabular-nums">
                {workbook.teams.length}
              </span>{" "}
              of {projectTeams.length} teams
            </span>
            {units > 0 && (
              <span className="text-muted-foreground">
                <span className="text-foreground font-medium tabular-nums">{units}</span> items
              </span>
            )}
            {overdue > 0 && (
              <span className="text-destructive flex items-center gap-1 font-medium">
                <TriangleAlert className="h-3 w-3" />
                {overdue} overdue
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {workbook.teams.length === 0 && (
            <div className="border-border/60 rounded-sm border border-dashed px-4 py-8 text-center">
              <p className="text-sm font-medium">No team is on this month&rsquo;s plan yet.</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {canAdd.length > 0
                  ? "Add one below, then set what they owe and by when."
                  : "Your account manager sets this up."}
              </p>
            </div>
          )}

          {workbook.teams.map((team) => (
            <TeamPlanRow
              key={team.id}
              {...props}
              team={team}
              today={today}
              autoFocus={team.teamId === focusTeamId}
            />
          ))}

          {canAdd.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-muted-foreground mr-1 text-[11px] font-medium">
                {canPlanAll ? "Not on the plan" : "Add your team"}
              </span>
              {/* Ghost buttons rather than six always-present empty rows - a
                  project that uses two teams should not scroll past four rows
                  of nothing. */}
              {canAdd.map((t) => (
                <Button
                  key={t.id}
                  variant="outline"
                  className="h-7 gap-1 px-2 text-xs"
                  disabled={props.pending}
                  onClick={() => props.onSave({ teamId: t.id })}
                >
                  <Plus className="h-3 w-3" /> {t.name}
                </Button>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function TeamPlanRow({
  projectId,
  workbook,
  team,
  today,
  autoFocus,
  canPlanAll,
  managedTeamId,
  myTeamId,
  onSave,
  onRemove,
  pending,
  onFilesChanged,
  projectTeams,
}: TeamPlanSheetProps & { team: WorkbookTeam; today: string; autoFocus: boolean }) {
  const canPlan = canPlanAll || managedTeamId === team.teamId
  // Links and files: anyone actually ON this team, plus everyone who can plan it.
  const canContribute = canPlan || myTeamId === team.teamId
  const isMine = myTeamId === team.teamId

  const tone = dueTone(team.dueOn, workbook.periodMonth, today)
  const progress = teamProgress(team)
  const [qty, setQty] = React.useState(String(team.quantity || ""))
  const [peopleOpen, setPeopleOpen] = React.useState(false)
  const [confirmRemove, setConfirmRemove] = React.useState(false)
  const [uploading, setUploading] = React.useState<string | null>(null)
  const fileInput = React.useRef<HTMLInputElement | null>(null)
  const ref = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => setQty(String(team.quantity || "")), [team.quantity])
  React.useEffect(() => {
    if (autoFocus) ref.current?.scrollIntoView({ block: "center", behavior: "smooth" })
  }, [autoFocus])

  const commitQty = () => {
    const next = qty.trim() === "" ? 0 : Number(qty)
    if (!Number.isInteger(next) || next < 0) {
      setQty(String(team.quantity || ""))
      toast.error("A quantity is a whole number")
      return
    }
    if (next !== team.quantity) onSave({ teamId: team.teamId, quantity: next })
  }

  async function upload(files: File[]) {
    // Checked here as well as on the server: pushing 300 MB up an agency
    // connection to be told no is a minutes-long mistake.
    const tooBig = files.filter((f) => f.size > MAX_UPLOAD_BYTES)
    for (const f of tooBig) {
      toast.error(`"${f.name}" is ${formatFileSize(f.size)} - the limit is ${MAX_UPLOAD_MB} MB`)
    }
    const queue = files.filter((f) => f.size <= MAX_UPLOAD_BYTES)
    if (queue.length === 0) return

    // One at a time: the server buffers each file whole, so parallel uploads of
    // large video are how you run it out of memory.
    let done = 0
    for (const file of queue) {
      setUploading(`${done + 1}/${queue.length}`)
      const body = new FormData()
      body.append("file", file)
      body.append("workbookTeamId", team.id)
      // Sent as well, and NOT redundant: it sets the storage prefix and the
      // resource's own team, which is what the Files tab filters on.
      body.append("teamId", team.teamId)
      body.append("category", "DELIVERABLES")
      try {
        await apiFetch(`/api/projects/${projectId}/resources`, { method: "POST", body })
        done++
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `Could not upload "${file.name}"`)
      }
    }
    setUploading(null)
    if (done > 0) {
      toast.success(`${done} file${done === 1 ? "" : "s"} added to ${team.teamName}`)
      onFilesChanged()
    }
  }

  async function detach(fileId: string) {
    try {
      await apiFetch(`/api/projects/${projectId}/resources/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workbookTeamId: null }),
      })
      toast.success("Removed from this plan. The file is still in Files.")
      onFilesChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove that file")
    }
  }

  const names = team.members.map((m) => m.firstName).join(", ")

  return (
    <section
      ref={ref}
      aria-label={`${team.teamName} plan`}
      className={cn(
        "border-border overflow-hidden rounded-sm border",
        isMine && "ring-primary/30 ring-1",
      )}
    >
      {/* Card header: who, and the one-line summary of what they owe. */}
      <header className="bg-muted/40 flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <h3 className="text-sm font-semibold tracking-tight">{team.teamName}</h3>
        {isMine && (
          <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-medium">
            Your team
          </Badge>
        )}

        <span className="ml-auto flex items-center gap-2">
          {/* What has actually been handed over, against what was promised.
              This is the number the status is measured by, so it sits beside
              it rather than buried among the fields below. */}
          {progress.quantity > 0 && (
            <span
              className={cn(
                "text-xs font-medium tabular-nums",
                progress.canComplete && "text-emerald-600 dark:text-emerald-400",
              )}
              title={handedInTitle(progress)}
            >
              {progress.handedIn}/{progress.quantity}
            </span>
          )}
          {/* Only when there IS a date, and only while the work is still owed -
              a finished row does not need a deadline shouting at it. */}
          {tone !== "none" && isOutstanding(team.status) && (
            <span className={cn("flex items-center gap-1 text-xs", TONE_CLASS[tone])}>
              {(tone === "overdue" || tone === "today" || tone === "soon") && (
                <TriangleAlert className="h-3 w-3 shrink-0" />
              )}
              {dueLabel(team.dueOn, tone, today)}
            </span>
          )}
          <StatusControl
            status={team.status}
            progress={progress}
            canEdit={canContribute}
            canDiscard={canPlan}
            pending={pending}
            onChange={(status) => onSave({ teamId: team.teamId, status })}
          />
          {canPlan && (
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              title={`Take ${team.teamName} off this month`}
              aria-label={`Take ${team.teamName} off this month`}
              className="text-muted-foreground/60 hover:text-destructive -mr-1 rounded-sm p-1 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </span>
      </header>

      <div className="divide-border/50 divide-y">
        <Field label="People">
          <div className="flex flex-wrap items-center gap-2">
            {team.members.length > 0 ? (
              <>
                <MemberAvatars people={team.members} max={6} />
                <span className="text-muted-foreground min-w-0 truncate text-xs">{names}</span>
              </>
            ) : (
              <span className="text-muted-foreground/60 text-xs">Nobody yet</span>
            )}
            {canPlan && (
              <Button
                variant="ghost"
                className="h-6 gap-1 px-1.5 text-[11px]"
                onClick={() => setPeopleOpen(true)}
              >
                <Plus className="h-3 w-3" />
                {/* Says the picker takes more than one. A bare "Change" beside
                    a single avatar read as though the row held one person. */}
                {team.members.length > 0 ? "Add or change people" : "Add people"}
              </Button>
            )}
          </div>
        </Field>

        <Field label="Due">
          <div className="flex flex-wrap items-center gap-3">
            {canPlan ? (
              // `modal` is mandatory inside a Sheet - it is a Dialog underneath,
              // and without it the calendar popover renders behind the panel.
              <DateField
                modal
                value={team.dueOn ?? ""}
                onChange={(v) => onSave({ teamId: team.teamId, dueOn: v || null })}
                placeholder="Pick a date"
                className="h-8 w-40 text-xs"
              />
            ) : (
              <span className="text-xs">{team.dueOn ?? "No date set"}</span>
            )}

            <span className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-[11px] font-medium">Quantity</span>
              {canPlan ? (
                <>
                  <Input
                    type="number"
                    min={0}
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    onBlur={commitQty}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur()
                    }}
                    disabled={pending}
                    placeholder="0"
                    className="h-8 w-16 text-xs tabular-nums"
                    aria-label={`How many ${team.teamName} owes`}
                  />
                  <span className="text-muted-foreground text-[11px]">items</span>
                </>
              ) : (
                <span className="text-xs tabular-nums">{team.quantity || "—"}</span>
              )}
            </span>
          </div>
        </Field>

        <Field label="Links">
          {/* The task URL lives here. TaskResources already owns http(s)
              validation, de-duplication and the chip rendering, so a third
              caller keeps that logic in one place instead of forking it. */}
          {team.links.length === 0 && !canContribute ? (
            <span className="text-muted-foreground/60 text-xs">No links</span>
          ) : (
            <TaskResources
              links={team.links}
              canEdit={canContribute}
              onCommit={(links) => onSave({ teamId: team.teamId, links })}
            />
          )}
        </Field>

        <Field label="Files">
          <div className="space-y-1.5">
            {team.attachments.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {team.attachments.map((f) => (
                  <span
                    key={f.id}
                    className="bg-foreground/5 flex max-w-full items-center gap-1.5 rounded-sm px-2 py-1 text-[11px]"
                  >
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate">{f.fileName}</span>
                    <span className="text-muted-foreground shrink-0">
                      {formatFileSize(f.fileSize)}
                      {f.driveFileId && " · Drive"}
                    </span>
                    {canContribute && (
                      <button
                        type="button"
                        onClick={() => void detach(f.id)}
                        // Said plainly, because "remove" reads as "delete" and
                        // somebody will go looking for the file afterwards.
                        title="Remove from this plan - the file stays in Files"
                        className="text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground/60 text-xs">
                {canContribute ? "Nothing handed in yet" : "No files"}
              </span>
            )}

            {canContribute && (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = [...(e.target.files ?? [])]
                    // Reset, or re-picking the same file never fires again.
                    e.target.value = ""
                    if (files.length > 0) void upload(files)
                  }}
                />
                <Button
                  variant="outline"
                  className="h-7 gap-1 px-2 text-[11px]"
                  disabled={uploading !== null}
                  onClick={() => fileInput.current?.click()}
                >
                  {uploading ? (
                    <>Uploading {uploading}…</>
                  ) : (
                    <>
                      <Upload className="h-3 w-3" /> Upload
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </Field>
      </div>

      {/* The rule, stated rather than only enforced.
          A team that promised four items needs four things handed over - links
          and files together - before the row can read Done. Hiding that until
          somebody tries to finish would make the disabled option look broken. */}
      {progress.quantity > 0 && team.status !== "DISCARDED" && (
        <div className="bg-muted/20 flex items-center gap-2 border-t px-3 py-1.5">
          <div
            className="bg-border h-1 w-16 shrink-0 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuenow={progress.handedIn}
            aria-valuemin={0}
            aria-valuemax={progress.quantity}
            aria-label={handedInTitle(progress)}
          >
            <div
              className={cn(
                "h-full rounded-full transition-all",
                progress.canComplete ? "bg-emerald-500" : "bg-primary/60",
              )}
              style={{ width: `${Math.round(progress.fraction * 100)}%` }}
            />
          </div>
          <span className="text-muted-foreground text-[11px]">
            <span className="text-foreground font-medium tabular-nums">
              {progress.handedIn} of {progress.quantity}
            </span>{" "}
            handed in
            {progress.shortBy > 0 && (
              <>
                {" · "}
                {progress.shortBy} more link{progress.shortBy === 1 ? "" : "s"} or file
                {progress.shortBy === 1 ? "" : "s"} to finish
              </>
            )}
          </span>
        </div>
      )}

      <TeamPeopleDialog
        open={peopleOpen}
        onClose={() => setPeopleOpen(false)}
        projectId={projectId}
        team={team}
        projectTeams={projectTeams}
        pending={pending}
        onSave={(employeeIds) => {
          onSave({ teamId: team.teamId, employeeIds })
          setPeopleOpen(false)
        }}
      />

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Take ${team.teamName} off this month?`}
        description={
          team.attachments.length > 0
            ? `Its due date, quantity and links go with it. The ${team.attachments.length} file${team.attachments.length === 1 ? "" : "s"} already handed in stay in the project's Files.`
            : "Its due date, quantity and links go with it."
        }
        confirmLabel="Remove team"
        variant="destructive"
        onConfirm={() => {
          onRemove(team.teamId)
          setConfirmRemove(false)
        }}
      />
    </section>
  )
}
