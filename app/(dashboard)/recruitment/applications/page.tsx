"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { apiFetch } from "@/lib/api-fetch"
import { useUrlPage, useUrlState } from "@/hooks/use-url-state"
import { useDebounce } from "@/hooks/use-debounce"
// lucide has no brand glyphs (no Linkedin), so LinkedIn/portfolio use generic icons.
import { Mail, Phone, Briefcase, Globe, FileText, ExternalLink, Users, Trash2 } from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { DataTable, type DataTableColumn } from "@/components/shared/data-table"
import { TableSearch } from "@/components/shared/table-search"
import { TableViewMenu } from "@/components/shared/table-view-menu"
import { StatusBadge } from "@/components/shared/status-badge"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import {
  useCareerApplications,
  useUpdateApplication,
  useDeleteApplication,
  type CareerApplication,
  type CareerApplicationStatus,
} from "@/features/careers/hooks/use-applications"
import { TONE, SYSTEM_ROLES } from "@/lib/constants"
import { formatRelativeTime } from "@/lib/utils"

const STATUS_COLORS: Record<string, string> = {
  RECEIVED: TONE.blue,
  IN_REVIEW: TONE.amber,
  SHORTLISTED: TONE.purple,
  REJECTED: TONE.red,
  HIRED: TONE.green,
}
const STATUS_LABELS: Record<string, string> = {
  RECEIVED: "New",
  IN_REVIEW: "In review",
  SHORTLISTED: "Shortlisted",
  REJECTED: "Rejected",
  HIRED: "Hired",
}
const STATUSES: CareerApplicationStatus[] = [
  "RECEIVED",
  "IN_REVIEW",
  "SHORTLISTED",
  "REJECTED",
  "HIRED",
]

export default function CareerApplicationsPage() {
  const [page, setPage] = useUrlPage()
  const [status, setStatus] = useUrlState("status", "all")
  const [mode, setMode] = useUrlState("mode", "all")
  const [q, setQ] = useState("")
  // Debounced: every keystroke would otherwise be a server request.
  const search = useDebounce(q.trim())
  const [selected, setSelected] = useState<CareerApplication | null>(null)
  const [toDelete, setToDelete] = useState<CareerApplication | null>(null)

  // Deleting is admin / HR-manager only (narrower than recruitment:write). The API enforces it too.
  const { data: session } = useSession()
  const roles = session?.user?.roles ?? []
  const canDelete =
    roles.includes(SYSTEM_ROLES.ADMIN) ||
    roles.includes(SYSTEM_ROLES.ADMIN_) ||
    roles.includes(SYSTEM_ROLES.HR_MANAGER)

  const { data, isLoading } = useCareerApplications({ page, status, mode, q: search })
  const del = useDeleteApplication()
  const rows = data?.data ?? []
  const meta = data?.meta
  const filtered = !!q || status !== "all" || mode !== "all"

  // Deep link from the "new application" notification (?id=...) opens that application.
  const deepLinkId = useSearchParams().get("id")
  useEffect(() => {
    if (!deepLinkId) return
    let alive = true
    apiFetch<{ data: CareerApplication }>(`/api/recruitment/applications/${deepLinkId}`)
      .then((res) => {
        if (alive) setSelected(res.data)
      })
      .catch(() => {
        // Deleted since the notification - the list is the right fallback.
      })
    return () => {
      alive = false
    }
  }, [deepLinkId])

  const columns: DataTableColumn<CareerApplication>[] = [
    {
      header: "Applicant",
      exportValue: (a) => a.fullName,
      cell: (a) => {
        const [first = "", ...rest] = a.fullName.split(" ")
        return (
          <div className="flex min-w-0 items-center gap-2.5">
            <AvatarDisplay
              firstName={first}
              lastName={rest.join(" ")}
              size="sm"
              className="shrink-0"
            />
            <div className="max-w-[240px] min-w-0">
              <p className="truncate text-sm font-medium">{a.fullName}</p>
              <p className="text-muted-foreground truncate text-xs" title={a.email}>
                {a.email}
              </p>
            </div>
          </div>
        )
      },
    },
    {
      header: "Email",
      defaultHidden: true,
      exportValue: (a) => a.email,
      cell: (a) => a.email,
    },
    {
      header: "Phone",
      defaultHidden: true,
      exportValue: (a) => a.phone,
      cell: (a) => a.phone,
    },
    {
      header: "Role",
      exportValue: (a) =>
        `${a.roleTitle} (${a.mode === "INTERNSHIP" ? "Internship" : "Full-time"})`,
      cell: (a) => {
        const detail = `${a.groupCode} · ${a.mode === "INTERNSHIP" ? "Internship" : "Full-time"}${
          a.opening ? ` · ${a.opening}` : ""
        }`
        return (
          <div className="max-w-[280px] min-w-0">
            <p className="truncate text-sm">{a.roleTitle}</p>
            <p className="text-muted-foreground truncate text-xs" title={detail}>
              {detail}
            </p>
          </div>
        )
      },
    },
    {
      header: "Flags",
      cell: (a) => (
        <div className="flex flex-wrap gap-1">
          {!a.roleResolved && (
            <Badge
              variant="outline"
              className="border-amber-400/40 text-[10px] text-amber-600 dark:text-amber-400"
              title="The role was closed or removed before this application arrived"
            >
              Role closed
            </Badge>
          )}
          {a.isRepeat && (
            <Badge variant="outline" className="text-muted-foreground text-[10px]">
              Re-applied
            </Badge>
          )}
        </div>
      ),
    },
    {
      header: "Applied",
      exportValue: (a) => a.submittedAt.slice(0, 10),
      cell: (a) => (
        <span className="text-muted-foreground text-xs">{formatRelativeTime(a.submittedAt)}</span>
      ),
    },
    {
      header: "Status",
      exportValue: (a) => STATUS_LABELS[a.status] ?? a.status,
      cell: (a) => (
        <StatusBadge
          status={a.status}
          colorMap={STATUS_COLORS}
          labelMap={STATUS_LABELS}
          size="xs"
          fallbackColor={TONE.neutral}
        />
      ),
    },
    {
      header: "",
      align: "right",
      cell: (a) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" onClick={() => setSelected(a)}>
            View
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              title="Delete application"
              onClick={() => setToDelete(a)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Applications"
        description="Candidates who applied through the careers site."
        actions={
          meta && meta.newCount > 0 ? (
            <Badge className="bg-destructive text-white">{meta.newCount} new</Badge>
          ) : undefined
        }
      />

      {isLoading || rows.length > 0 || filtered ? (
        <DataTable
          tableId="career-applications"
          exportName="applications"
          columns={columns}
          rows={rows}
          rowKey={(a) => a.id}
          showSerial
          serialOffset={((meta?.page ?? 1) - 1) * (meta?.limit ?? 20)}
          minWidth="min-w-[860px]"
          loading={isLoading}
          toolbar={
            <>
              <TableViewMenu
                label="Status"
                value={status}
                options={[
                  { value: "all", label: "All" },
                  ...STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] ?? s })),
                ]}
                onChange={(v) => {
                  setStatus(v)
                  setPage(1)
                }}
              />
              <TableSearch
                value={q}
                onChange={(v) => {
                  setQ(v)
                  setPage(1)
                }}
                placeholder="Search name, email or role…"
                label="Search name, email or role"
              />
              <Select
                value={mode}
                onValueChange={(v) => {
                  setMode(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-9 w-36" aria-label="Type">
                  <SelectValue placeholder="Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="FULL_TIME">Full-time</SelectItem>
                  <SelectItem value="INTERNSHIP">Internship</SelectItem>
                </SelectContent>
              </Select>
            </>
          }
          pagination={
            meta
              ? {
                  page: meta.page,
                  totalPages: meta.totalPages,
                  total: meta.total,
                  onPageChange: setPage,
                  itemLabel: "application",
                  pageSize: meta.limit,
                }
              : undefined
          }
          empty="No applications match these filters."
        />
      ) : (
        <EmptyState
          variant="card"
          icon={Users}
          title="No applications yet"
          description="Applications submitted on the careers site will appear here."
        />
      )}

      <ApplicationSheet application={selected} onClose={() => setSelected(null)} />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this application?"
        description={
          toDelete
            ? `This permanently removes ${toDelete.fullName}'s application for ${toDelete.roleTitle}. It cannot be undone, and the candidate has no other record in DNMS.`
            : ""
        }
        confirmLabel="Delete"
        variant="destructive"
        isLoading={del.isPending}
        onConfirm={() => {
          if (!toDelete) return
          del.mutate(toDelete.id, {
            onSuccess: () => {
              // Close the detail sheet too if we just deleted the open one.
              setSelected((cur) => (cur?.id === toDelete.id ? null : cur))
              setToDelete(null)
            },
          })
        }}
      />
    </div>
  )
}

function ApplicationSheet({
  application,
  onClose,
}: {
  application: CareerApplication | null
  onClose: () => void
}) {
  const update = useUpdateApplication()
  const [notes, setNotes] = useState("")
  const [notesFor, setNotesFor] = useState<string | null>(null)

  // Sync the notes box when a different application is opened.
  if (application && notesFor !== application.id) {
    setNotesFor(application.id)
    setNotes(application.hrNotes ?? "")
  }

  if (!application) return null
  const a = application

  return (
    <Sheet open={!!application} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="pr-8">{a.fullName}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-8">
          <div>
            <p className="text-sm font-medium">{a.roleTitle}</p>
            <p className="text-muted-foreground text-xs">
              {a.groupCode} · {a.departmentTitle} ·{" "}
              {a.mode === "INTERNSHIP" ? "Internship" : "Full-time"}
            </p>
            {a.opening && (
              <p className="text-muted-foreground mt-0.5 text-xs">Opening: {a.opening}</p>
            )}
            {!a.roleResolved && (
              <p className="mt-2 rounded-sm border border-amber-400/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-600 dark:text-amber-400">
                This role was closed or removed before the application arrived. The candidate
                applied in good faith - the titles above are what they saw.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium">Status</p>
            <Select
              value={a.status}
              onValueChange={(v) =>
                update.mutate({ id: a.id, body: { status: v as CareerApplicationStatus } })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium">Contact</p>
            <ContactRow icon={Mail} label={a.email} href={`mailto:${a.email}`} />
            <ContactRow icon={Phone} label={a.phone} href={`tel:${a.phone}`} />
            <ContactRow icon={Briefcase} label="LinkedIn" href={a.linkedIn} external />
            <ContactRow icon={Globe} label="Portfolio" href={a.portfolio} external />
            <ContactRow icon={FileText} label="Resume / CV" href={a.resumeUrl} external />
          </div>

          {a.message && (
            <div className="space-y-1.5">
              <p className="text-muted-foreground text-xs font-medium">Message</p>
              <p className="bg-muted/50 rounded-sm p-3 text-sm leading-relaxed whitespace-pre-wrap">
                {a.message}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs font-medium">Internal notes</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Notes for the hiring team…"
              aria-label="Notes for the hiring team"
            />
            <Button
              variant="outline"
              loading={update.isPending}
              onClick={() => update.mutate({ id: a.id, body: { hrNotes: notes } })}
            >
              Save notes
            </Button>
          </div>

          <div className="text-muted-foreground space-y-0.5 border-t pt-3 text-[11px]">
            <p>Applied {formatRelativeTime(a.submittedAt)}</p>
            <p className="break-all">From: {a.sourceUrl}</p>
            <p className="break-all">Ref: {a.id}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ContactRow({
  icon: Icon,
  label,
  href,
  external,
}: {
  icon: React.ElementType
  label: string
  href: string
  external?: boolean
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="hover:bg-muted/60 flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors"
    >
      <Icon className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {external && <ExternalLink className="text-muted-foreground h-3 w-3 shrink-0" />}
    </a>
  )
}
