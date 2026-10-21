"use client"

import { ChevronDown, Crown, Layers } from "lucide-react"

import { Link } from "@/components/tenant-link"
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { serviceInfo } from "@/features/projects/lib/project-services"
import { projectHref } from "@/features/projects/lib/project-href"
import type { EmployeeListItem, ProjectLabel } from "../hooks/use-employees"

// The directory's project columns: which projects someone runs as account manager (primary or
// secondary), and what they do on each live project - with a window that lays it all out.

export type AmView = "P" | "S"
const AM_VIEW_LABEL: Record<AmView, string> = { P: "Primary", S: "Secondary" }

const label = (p: ProjectLabel) => p.shortName || p.name

export interface ProjectRoleRow {
  project: ProjectLabel
  /** Their account-manager seat on it, if any. */
  am: "Primary" | "Secondary" | null
  teams: { name: string; lead: boolean }[]
  services: { name: string; secondary: boolean }[]
}

/** Everything they do per live project, account manager seat included; projects A-Z. */
export function projectRoles(e: EmployeeListItem): ProjectRoleRow[] {
  const rows = new Map<string, ProjectRoleRow>()
  const row = (project: ProjectLabel) => {
    const r = rows.get(project.id) ?? { project, am: null, teams: [], services: [] }
    rows.set(project.id, r)
    return r
  }
  for (const p of e.ownedProjects ?? []) row(p).am = "Primary"
  for (const p of e.secondaryAmProjects ?? []) row(p).am ??= "Secondary"
  const team = (project: ProjectLabel, name: string, lead: boolean) => {
    const r = row(project)
    const t = r.teams.find((x) => x.name === name)
    if (t) t.lead ||= lead
    else r.teams.push({ name, lead })
  }
  for (const m of e.projectTeamMemberships ?? []) team(m.team.project, m.team.name, false)
  for (const t of e.managedTeams ?? []) team(t.project, t.name, true)
  const service = (project: ProjectLabel, code: string, secondary: boolean) =>
    row(project).services.push({ name: serviceInfo(code)?.name ?? code, secondary })
  for (const s of e.ownedProjectServices ?? []) service(s.project, s.service, false)
  for (const s of e.secondaryServiceOwnerships ?? []) service(s.project, s.service, true)
  return [...rows.values()].sort((a, b) => label(a.project).localeCompare(label(b.project)))
}

const rolesText = (r: ProjectRoleRow) =>
  [
    r.am && `${r.am} account manager`,
    ...r.teams.map((t) => (t.lead ? `${t.name} lead` : t.name)),
    ...r.services.map((s) => `${s.name} ${s.secondary ? "secondary owner" : "owner"}`),
  ]
    .filter(Boolean)
    .join(", ")

export function accountManagerText(e: EmployeeListItem): string {
  const primary = (e.ownedProjects ?? []).map(label)
  const secondary = (e.secondaryAmProjects ?? []).map(label)
  return [
    primary.length > 0 && `Primary: ${primary.join(", ")}`,
    secondary.length > 0 && `Secondary: ${secondary.join(", ")}`,
  ]
    .filter(Boolean)
    .join("; ")
}

export function projectRolesText(e: EmployeeListItem): string {
  return projectRoles(e)
    .map((r) => `${label(r.project)}: ${rolesText(r)}`)
    .join("; ")
}

/** "(Primary) v" beside the column header, as on the Projects list. */
export function AmViewSwitch({
  value,
  onChange,
}: {
  value: AmView
  onChange: (v: AmView) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 text-[11px] font-normal"
          aria-label="Show the projects they run as primary or as secondary account manager"
        >
          ({AM_VIEW_LABEL[value]})
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as AmView)}>
          <DropdownMenuRadioItem value="P">P · Primary</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="S">S · Secondary</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The projects they run in the chosen seat, each opening the project. */
export function AccountManagerCell({
  employee,
  view,
}: {
  employee: EmployeeListItem
  view: AmView
}) {
  const projects = (view === "P" ? employee.ownedProjects : employee.secondaryAmProjects) ?? []
  if (projects.length === 0) return <span className="text-muted-foreground text-xs">None</span>
  return (
    <div className="flex max-w-52 flex-wrap gap-1">
      {projects.map((p) => (
        <Link
          key={p.id}
          href={projectHref(p)}
          title={`${p.name} - ${AM_VIEW_LABEL[view].toLowerCase()} account manager`}
          className={
            view === "P"
              ? "bg-primary/10 text-primary hover:bg-primary/20 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold"
              : "text-foreground hover:bg-muted rounded-sm border px-1.5 py-0.5 text-[11px] font-medium"
          }
        >
          {label(p)}
        </Link>
      ))}
    </div>
  )
}

const MAX_CHIPS = 4

/** A short read of their projects; it opens the full picture. */
export function ProjectRolesCell({
  employee,
  onOpen,
}: {
  employee: EmployeeListItem
  onOpen: () => void
}) {
  const rows = projectRoles(employee)
  if (rows.length === 0) return <span className="text-muted-foreground text-xs">None</span>
  const leads = rows.reduce((n, r) => n + r.teams.filter((t) => t.lead).length, 0)
  const services = rows.reduce((n, r) => n + r.services.length, 0)
  const summary = [
    `${rows.length} project${rows.length === 1 ? "" : "s"}`,
    leads > 0 && `leads ${leads} team${leads === 1 ? "" : "s"}`,
    services > 0 && `owns ${services} service${services === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" · ")
  return (
    <button
      type="button"
      onClick={onOpen}
      title="See what they do on each project"
      className="hover:bg-muted/50 focus-visible:ring-ring -mx-1.5 block max-w-60 rounded-sm px-1.5 py-1 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <span className="flex flex-wrap gap-1">
        {rows.slice(0, MAX_CHIPS).map((r) => (
          <span
            key={r.project.id}
            className="bg-muted text-foreground rounded-sm px-1.5 py-0.5 text-[11px] font-medium"
          >
            {label(r.project)}
          </span>
        ))}
        {rows.length > MAX_CHIPS && (
          <span className="text-muted-foreground px-1 py-0.5 text-[11px]">
            +{rows.length - MAX_CHIPS}
          </span>
        )}
      </span>
      <span className="text-muted-foreground mt-1 block text-[11px]">{summary}</span>
    </button>
  )
}

/** Every live project they are on: their account-manager seat, teams (and which they lead), services. */
export function EmployeeProjectsDialog({
  employee,
  onClose,
}: {
  employee: EmployeeListItem | null
  onClose: () => void
}) {
  const rows = employee ? projectRoles(employee) : []
  return (
    <Dialog open={employee !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {employee && (
          <>
            <DialogHeader>
              <DialogTitle>
                {employee.firstName} {employee.lastName} - projects
              </DialogTitle>
              <DialogDescription>
                What they do on each live project. Click a project to open it.
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-x-auto rounded-sm border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-muted-foreground text-left text-[11px] tracking-wide uppercase">
                    <th className="px-3 py-2 font-medium">Project</th>
                    <th className="px-3 py-2 font-medium">Account manager</th>
                    <th className="px-3 py-2 font-medium">Teams</th>
                    <th className="px-3 py-2 font-medium">Services owned</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.project.id} className="align-top">
                      <td className="px-3 py-2.5">
                        <Link
                          href={projectHref(r.project)}
                          className="font-semibold hover:underline"
                        >
                          {label(r.project)}
                        </Link>
                        {r.project.shortName && (
                          <span className="text-muted-foreground block text-[11px]">
                            {r.project.name}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {r.am ? (
                          <span
                            className={
                              r.am === "Primary"
                                ? "bg-primary/10 text-primary rounded-sm px-1.5 py-0.5 font-semibold"
                                : "rounded-sm border px-1.5 py-0.5 font-medium"
                            }
                          >
                            {r.am}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {r.teams.length === 0 ? (
                          <span className="text-muted-foreground text-xs">-</span>
                        ) : (
                          <span className="flex flex-wrap gap-1">
                            {r.teams.map((t) => (
                              <span
                                key={t.name}
                                title={t.lead ? "Leads this team" : "On this team"}
                                className={
                                  t.lead
                                    ? "inline-flex items-center gap-1 rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300"
                                    : "bg-muted rounded-sm px-1.5 py-0.5 text-[11px]"
                                }
                              >
                                {t.lead && <Crown className="h-3 w-3" />}
                                {t.name}
                              </span>
                            ))}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {r.services.length === 0 ? (
                          <span className="text-muted-foreground text-xs">-</span>
                        ) : (
                          <span className="flex flex-wrap gap-1">
                            {r.services.map((s) => (
                              <span
                                key={`${s.name}-${s.secondary}`}
                                className="inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px]"
                              >
                                <Layers className="text-muted-foreground h-3 w-3" />
                                {s.name}
                                {s.secondary && (
                                  <span className="text-muted-foreground">· 2nd</span>
                                )}
                              </span>
                            ))}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
              <Crown className="h-3 w-3" /> leads the team · 2nd = secondary owner
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** "L3" from the designation's code, or its level. */
export function designationLevel(d: EmployeeListItem["designation"]): string | null {
  if (!d) return null
  return d.code || (d.level ? `L${d.level}` : null)
}
