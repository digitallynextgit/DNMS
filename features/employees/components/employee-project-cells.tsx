"use client"

import { Link } from "@/components/tenant-link"
import { serviceInfo } from "@/features/projects/lib/project-services"
import { projectHref } from "@/features/projects/lib/project-href"
import type { EmployeeListItem, ProjectLabel } from "../hooks/use-employees"

// The directory's project columns: which projects someone runs as account manager, and what they
// do on each live project (teams they are on or lead, services they own).

const label = (p: ProjectLabel) => p.shortName || p.name

export interface ProjectRoles {
  project: ProjectLabel
  roles: string[]
}

/** One line per live project: their teams (marking the ones they lead) and the services they own. */
export function projectRoles(e: EmployeeListItem): ProjectRoles[] {
  const byProject = new Map<string, { project: ProjectLabel; roles: string[] }>()
  const add = (project: ProjectLabel, role: string) => {
    const row = byProject.get(project.id) ?? { project, roles: [] }
    if (!row.roles.includes(role)) row.roles.push(role)
    byProject.set(project.id, row)
  }
  const leads = new Set((e.managedTeams ?? []).map((t) => `${t.project.id}:${t.name}`))
  for (const m of e.projectTeamMemberships ?? []) {
    add(
      m.team.project,
      leads.has(`${m.team.project.id}:${m.team.name}`) ? `${m.team.name} lead` : m.team.name,
    )
  }
  // Leading a team they aren't listed on still says what they do there.
  for (const t of e.managedTeams ?? []) add(t.project, `${t.name} lead`)
  for (const s of e.ownedProjectServices ?? []) {
    add(s.project, `${serviceInfo(s.service)?.label ?? s.service} owner`)
  }
  for (const s of e.secondaryServiceOwnerships ?? []) {
    add(s.project, `${serviceInfo(s.service)?.label ?? s.service} 2nd owner`)
  }
  return [...byProject.values()].sort((a, b) => label(a.project).localeCompare(label(b.project)))
}

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
    .map((r) => `${label(r.project)}: ${r.roles.join(", ")}`)
    .join("; ")
}

/** Primary projects as solid chips, secondary ones outlined; each opens the project. */
export function AccountManagerCell({ employee }: { employee: EmployeeListItem }) {
  const primary = employee.ownedProjects ?? []
  const secondary = employee.secondaryAmProjects ?? []
  if (primary.length === 0 && secondary.length === 0) {
    return <span className="text-muted-foreground">-</span>
  }
  return (
    <div className="flex max-w-56 flex-wrap gap-1">
      {primary.map((p) => (
        <Link
          key={p.id}
          href={projectHref(p)}
          title={`${p.name} - primary account manager`}
          className="bg-primary/10 text-primary hover:bg-primary/20 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold"
        >
          {label(p)}
        </Link>
      ))}
      {secondary.map((p) => (
        <Link
          key={p.id}
          href={projectHref(p)}
          title={`${p.name} - secondary account manager`}
          className="text-muted-foreground hover:text-foreground rounded-sm border px-1.5 py-0.5 text-[11px] font-medium"
        >
          {label(p)} · 2nd
        </Link>
      ))}
    </div>
  )
}

const SHOWN = 3

/** What they do on each live project: "H2S  SMO, DESIGN lead, SMO owner". */
export function ProjectRolesCell({ employee }: { employee: EmployeeListItem }) {
  const rows = projectRoles(employee)
  if (rows.length === 0) return <span className="text-muted-foreground">-</span>
  const shown = rows.slice(0, SHOWN)
  const rest = rows.slice(SHOWN)
  return (
    <div className="max-w-72 space-y-0.5 text-xs">
      {shown.map((r) => (
        <p
          key={r.project.id}
          className="truncate"
          title={`${r.project.name}: ${r.roles.join(", ")}`}
        >
          <Link href={projectHref(r.project)} className="font-semibold hover:underline">
            {label(r.project)}
          </Link>
          <span className="text-muted-foreground"> {r.roles.join(", ")}</span>
        </p>
      ))}
      {rest.length > 0 && (
        <p
          className="text-muted-foreground"
          title={rest.map((r) => `${label(r.project)}: ${r.roles.join(", ")}`).join("\n")}
        >
          +{rest.length} more project{rest.length === 1 ? "" : "s"}
        </p>
      )}
    </div>
  )
}

/** "L3" from the designation's code, or its level. */
export function designationLevel(d: EmployeeListItem["designation"]): string | null {
  if (!d) return null
  return d.code || (d.level ? `L${d.level}` : null)
}
