"use client"

import * as React from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { exportToCsv } from "@/lib/export-csv"
import { exportToXlsx } from "@/lib/export-xlsx"
import { TASK_STATUS_LABELS, TASK_PRIORITY_LABELS } from "@/lib/constants"

// ─────────────────────────────────────────────────────────────────────────────
// Taking the task list out of the app.
//
// EXPORTS WHAT IS ON SCREEN, filters and all. An export that quietly ignored
// the project and status filters would hand somebody a different answer from
// the one they were looking at, which is the kind of thing people only notice
// after they have sent it on.
//
// The row shape is declared structurally rather than imported, so this stays
// usable from any task list without dragging that page's model along with it.
// ─────────────────────────────────────────────────────────────────────────────

/** The fields the export reads. A page's own task type satisfies it as-is. */
export interface ExportableTask {
  title: string
  description: string | null
  status: string
  priority: string
  dueDate: string | null
  loggedHours: number
  estimatedHours: number | null
  links: string[]
  approvalStatus: string
  createdAt: string
  project: { name: string; code: string } | null
  team?: { name: string } | null
  assignee?: { firstName: string; lastName: string } | null
  goal?: { title: string } | null
  requirement?: { title: string } | null
}

const COLUMNS = [
  "Project",
  "Code",
  "Task",
  "Status",
  "Priority",
  "Due date",
  "Assignee",
  "Team",
  "Goal",
  "Blocked by",
  "Estimated hrs",
  "Logged hrs",
  "Approval",
  "Resources",
  "Notes",
  "Created",
] as const

/** yyyy-MM-dd, or blank. Spreadsheets sort that; "7 Sept 2026" they do not. */
const day = (iso: string | null | undefined): string => (iso ? iso.slice(0, 10) : "")

const label = (map: Record<string, string>, key: string): string => map[key] ?? key

function toRows(tasks: readonly ExportableTask[]) {
  return tasks.map((t) => [
    // Adhoc work has no client, and an empty cell would read as missing data.
    t.project?.name ?? "Ad-hoc",
    t.project?.code ?? "",
    t.title,
    label(TASK_STATUS_LABELS as Record<string, string>, t.status),
    label(TASK_PRIORITY_LABELS as Record<string, string>, t.priority),
    day(t.dueDate),
    t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}`.trim() : "",
    t.team?.name ?? "",
    t.goal?.title ?? "",
    t.requirement?.title ?? "",
    t.estimatedHours ?? "",
    t.loggedHours,
    t.approvalStatus === "APPROVED" ? "" : t.approvalStatus.replace(/_/g, " ").toLowerCase(),
    t.links.join(" "),
    t.description ?? "",
    day(t.createdAt),
  ])
}

export function TasksExportMenu({
  tasks,
  /** Goes in the filename: "my-tasks", a person's name, a project. */
  scope = "tasks",
  className,
}: {
  tasks: readonly ExportableTask[]
  scope?: string
  className?: string
}) {
  const [busy, setBusy] = React.useState(false)

  const slug =
    scope
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "tasks"
  const stamp = new Date().toISOString().slice(0, 10)
  const base = `${slug}-${stamp}`

  const run = async (kind: "xlsx" | "csv") => {
    if (tasks.length === 0) return
    setBusy(true)
    try {
      const rows = toRows(tasks)
      if (kind === "csv") {
        exportToCsv([...COLUMNS], rows, `${base}.csv`)
      } else {
        await exportToXlsx([...COLUMNS], rows, `${base}.xlsx`, "Tasks")
      }
      toast.success(`Exported ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={tasks.length === 0 || busy}
          className={cn("gap-1.5", className)}
          title={tasks.length === 0 ? "Nothing to export" : `Export ${tasks.length} tasks`}
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onClick={() => void run("xlsx")} className="flex-col items-start gap-0.5">
          <span>Excel (.xlsx)</span>
          <span className="text-muted-foreground text-[11px]">Sized columns, header frozen</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void run("csv")} className="flex-col items-start gap-0.5">
          <span>CSV</span>
          <span className="text-muted-foreground text-[11px]">Opens anywhere</span>
        </DropdownMenuItem>
        {/* Says what is in the file BEFORE it is opened, because the filters
            above are the difference between 6 rows and 340. */}
        <p className="text-muted-foreground border-t px-2 py-1.5 text-[11px]">
          {tasks.length} {tasks.length === 1 ? "task" : "tasks"} - what the filters show
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
