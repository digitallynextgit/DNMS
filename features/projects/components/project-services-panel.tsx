"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, Check, ChevronDown, Plus, X } from "lucide-react"

import { AvatarDisplay } from "@/components/shared/avatar-display"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Link, useTenantPath } from "@/components/tenant-link"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import {
  useCreateServiceCalendar,
  useProjectMembers,
  useSetProjectServices,
  useSetServiceOwner,
} from "../hooks/use-projects"
import { useSheetMutations, useWorkbookIndex } from "../hooks/use-sheets"
import {
  currentPlanMonth,
  formatMonth,
  formatMonthShort,
  monthISO,
  parseMonth,
  shiftMonth,
} from "../lib/calendar-months"
import {
  LEAD_SERVICE,
  PROJECT_SERVICES,
  normaliseServices,
  type ServiceOwner,
} from "../lib/project-services"
import type { WorkbookIndexEntry } from "../lib/sheet-types"
import { ServiceChip } from "./service-chips"
import { cn } from "@/lib/utils"

const NO_OWNER = "__none__"

type Service = (typeof PROJECT_SERVICES)[number]

function OwnerLabel({
  person,
  empty = "No owner",
}: {
  person: ServiceOwner["employee"] | null
  empty?: string
}) {
  if (!person) return <span className="text-muted-foreground truncate text-xs">{empty}</span>
  return (
    <span className="flex min-w-0 items-center gap-2">
      <AvatarDisplay
        src={person.profilePhoto}
        firstName={person.firstName}
        lastName={person.lastName}
        size="xs"
      />
      <span className="truncate text-sm">
        {person.firstName} {person.lastName}
      </span>
    </span>
  )
}

/**
 * A service's calendar months: open any month it has, or (managers) start a nearby month that is
 * missing, copying the newest month's tabs and team plan.
 */
function ServiceCalendarMenu({
  projectId,
  projectPath,
  service,
  editions,
  canManage,
}: {
  projectId: string
  projectPath: string
  service: Service
  /** Newest month first. */
  editions: WorkbookIndexEntry[]
  canManage: boolean
}) {
  const router = useRouter()
  const tenantPath = useTenantPath()
  const m = useSheetMutations(projectId)
  const thisMonth = currentPlanMonth()
  const shown = editions.find((w) => w.periodMonth?.startsWith(thisMonth)) ?? editions[0]!
  const hrefOf = (id: string) => `${projectPath}?tab=calendar&calendar=${id}`

  // Two months back to three ahead, minus the months that already exist.
  const now = parseMonth(`${thisMonth}-01`)!
  const missing = [-2, -1, 0, 1, 2, 3]
    .map((by) => shiftMonth(now, by))
    .map((ym) => monthISO(ym.year, ym.month0))
    .filter((iso) => !editions.some((w) => w.periodMonth?.startsWith(iso.slice(0, 7))))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="text-muted-foreground hover:text-foreground h-7 gap-1 px-2 text-xs"
          aria-label={`${service.name} calendar months`}
          disabled={m.createWorkbook.isPending}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          {formatMonthShort(shown.periodMonth)}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 min-w-52 overflow-y-auto">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
          {shown.name}
        </DropdownMenuLabel>
        {editions.map((w) => (
          <DropdownMenuItem key={w.id} asChild>
            <Link href={hrefOf(w.id)} aria-label={`Open the ${service.name} calendar`}>
              <span className="flex-1">{formatMonth(w.periodMonth)}</span>
              {w.id === shown.id ? <Check className="h-3.5 w-3.5" /> : null}
            </Link>
          </DropdownMenuItem>
        ))}
        {canManage && missing.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
              Start a month
            </DropdownMenuLabel>
            {missing.map((iso) => (
              <DropdownMenuItem
                key={iso}
                onSelect={() =>
                  m.createWorkbook.mutate(
                    {
                      name: shown.name,
                      periodMonth: iso,
                      copyFrom: { workbookId: editions[0]!.id, structure: true, teamPlan: true },
                    },
                    { onSuccess: (w) => router.push(tenantPath(hrefOf(w.id))) },
                  )
                }
              >
                <Plus className="h-3.5 w-3.5" />
                {formatMonth(iso)}
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * One tile per service: who owns it and its calendar, by month. Managers pick owners from the
 * people on the project, add or remove services, and can start a calendar a service is missing.
 */
export function ProjectServicesPanel({
  projectId,
  projectPath,
  services,
  owners,
  canManage,
  title,
  action,
}: {
  projectId: string
  /** The project page, for "Open calendar" links, e.g. projectHref(project). */
  projectPath: string
  services: readonly string[]
  owners: readonly ServiceOwner[]
  canManage: boolean
  /** Heading on the left of the toolbar ("Add a service" sits on the right). */
  title?: ReactNode
  /** Extra control at the right end of the toolbar, e.g. "Open calendars". */
  action?: ReactNode
}) {
  const rows = PROJECT_SERVICES.filter((s) => services.includes(s.code))
  const unticked = PROJECT_SERVICES.filter((s) => !services.includes(s.code))
  const people = useProjectMembers(canManage ? projectId : undefined)
  const calendars = useWorkbookIndex(rows.length > 0 ? projectId : "")
  const setOwner = useSetServiceOwner(projectId)
  const setServices = useSetProjectServices(projectId)
  const createCalendar = useCreateServiceCalendar(projectId)
  const [removing, setRemoving] = useState<Service | null>(null)

  const save = (next: string[]) => setServices.mutate(normaliseServices(next))

  const addMenu =
    canManage && unticked.length > 0 ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-1 px-2" disabled={setServices.isPending}>
            <Plus className="h-3.5 w-3.5" />
            Add a service
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
          {unticked.map((s) => (
            <DropdownMenuItem key={s.code} onSelect={() => save([...services, s.code])}>
              <ServiceChip code={s.code} />
              <span>{s.name}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null

  const toolbar =
    title || addMenu || action ? (
      <div className="flex flex-wrap items-center justify-between gap-2">
        {title ?? <span />}
        <div className="flex items-center gap-1">
          {addMenu}
          {action}
        </div>
      </div>
    ) : null

  if (rows.length === 0) {
    return (
      <div className="space-y-2">
        {toolbar}
        <p className="text-muted-foreground text-sm">No services yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {toolbar}
      {/* Sized by the space it gets, so it reads the same on the page and in the popup. */}
      <div className="@container">
        <ul className="grid gap-2 @xl:grid-cols-2 @4xl:grid-cols-3">
          {rows.map((s) => {
            const owner = owners.find((o) => o.service === s.code)?.employee ?? null
            const saving = setOwner.isPending && setOwner.variables?.service === s.code
            const editions = (calendars.data ?? []).filter((w) => w.service === s.code)
            return (
              <li
                key={s.code}
                className="group relative flex min-w-0 flex-col gap-1.5 rounded-sm border px-3 py-2.5"
              >
                <div className={cn("flex min-w-0 items-center gap-2", canManage && "pr-6")}>
                  <ServiceChip code={s.code} />
                  <span className="truncate text-sm font-medium">{s.name}</span>
                  {s.code === LEAD_SERVICE ? (
                    <span
                      className="bg-primary text-primary-foreground shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold"
                      title="Campaign Planning sets the direction for every other calendar"
                    >
                      Leads all
                    </span>
                  ) : null}
                </div>

                <div className="flex min-w-0 items-center justify-between gap-2">
                  {canManage ? (
                    <Select
                      value={owner?.id ?? NO_OWNER}
                      onValueChange={(v) =>
                        setOwner.mutate({ service: s.code, employeeId: v === NO_OWNER ? null : v })
                      }
                      disabled={saving}
                    >
                      <SelectTrigger
                        className="hover:bg-muted -ml-1.5 h-7 w-auto max-w-full min-w-0 gap-1 border-0 bg-transparent px-1.5 focus:ring-offset-0"
                        aria-label={`Owner of ${s.name}`}
                      >
                        {/* A div, not a span: the trigger line-clamps span children, which stacks the avatar. */}
                        <div className="flex min-w-0 items-center">
                          <OwnerLabel person={owner} empty="Assign an owner" />
                        </div>
                      </SelectTrigger>
                      <SelectContent align="start" className="max-h-72">
                        <SelectItem value={NO_OWNER}>
                          <span className="text-muted-foreground text-xs">No owner</span>
                        </SelectItem>
                        {(people.data?.data ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <span className="flex items-center gap-2">
                              <AvatarDisplay
                                src={p.profilePhoto}
                                firstName={p.firstName}
                                lastName={p.lastName}
                                size="xs"
                              />
                              <span className="truncate">
                                {p.firstName} {p.lastName}
                              </span>
                              <span className="text-muted-foreground truncate text-[11px]">
                                {p.isManager ? "Account Manager" : p.designation?.title}
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex h-7 min-w-0 items-center">
                      <OwnerLabel person={owner} />
                    </div>
                  )}

                  <div className="shrink-0">
                    {editions.length > 0 ? (
                      <ServiceCalendarMenu
                        projectId={projectId}
                        projectPath={projectPath}
                        service={s}
                        editions={editions}
                        canManage={canManage}
                      />
                    ) : calendars.isLoading ? null : canManage ? (
                      <Button
                        variant="ghost"
                        className="text-muted-foreground hover:text-foreground h-7 gap-1 px-2 text-xs"
                        disabled={createCalendar.isPending}
                        onClick={() => createCalendar.mutate(s.code)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Create calendar
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-xs">No calendar</span>
                    )}
                  </div>
                </div>

                {canManage ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    // Shown on hover where there is a mouse; always there on touch screens.
                    className="text-muted-foreground hover:text-destructive absolute top-1.5 right-1.5 h-6 w-6 focus-visible:opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100"
                    aria-label={`Remove ${s.name}`}
                    title={`Remove ${s.name}`}
                    disabled={setServices.isPending}
                    onClick={() => setRemoving(s)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
      {canManage && (
        <p className="text-muted-foreground text-xs">
          A service&apos;s owner also owns its calendar. Owners come from this project&apos;s teams
          and are told by notification and email.
        </p>
      )}

      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.name ?? "this service"}?`}
        description="Its owner is cleared. Its calendar and everything in it stay, and come back linked if you add the service again."
        confirmLabel="Remove"
        variant="destructive"
        isLoading={setServices.isPending}
        onConfirm={() => {
          if (!removing) return
          save(services.filter((c) => c !== removing.code))
          setRemoving(null)
        }}
      />
    </div>
  )
}

/** The services popup on the projects list: the same panel, for one project. */
export function ProjectServicesDialog({
  project,
  projectPath,
  canManage,
  onClose,
}: {
  project: {
    id: string
    name: string
    shortName: string | null
    services: readonly string[]
    serviceOwners: readonly ServiceOwner[]
  } | null
  /** The project page, e.g. projectHref(project). */
  projectPath: string
  canManage: boolean
  onClose: () => void
}) {
  return (
    <Dialog open={!!project} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {project?.shortName ? `${project.shortName} · ` : ""}
            {project?.name} - Services
          </DialogTitle>
          <DialogDescription>Who owns each service, and its calendar by month.</DialogDescription>
        </DialogHeader>
        {project ? (
          <ProjectServicesPanel
            projectId={project.id}
            projectPath={projectPath}
            services={project.services}
            owners={project.serviceOwners}
            canManage={canManage}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
