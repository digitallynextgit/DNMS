import type { Prisma } from "@prisma/client"

export interface ReportingRow {
  id: string
  managerId: string | null
  dottedManagerId: string | null
}

/** An employee's two managers. The dotted one shares every manager power, every day. */
export interface ManagedRow {
  managerId: string | null
  dottedManagerId?: string | null
}

export function managerIdsOf(e: ManagedRow | null | undefined): string[] {
  if (!e) return []
  return [...new Set([e.managerId, e.dottedManagerId].filter((id): id is string => !!id))]
}

/** `me` is this employee's reporting or dotted manager. */
export function isManagerOf(e: ManagedRow | null | undefined, me: string): boolean {
  return managerIdsOf(e).includes(me)
}

/** Prisma filter: the employees `me` manages directly, as reporting or dotted manager. Nest
 *  it (`AND: [managedBy(me)]`) where the filter has its own OR. */
export function managedBy(me: string): Prisma.EmployeeWhereInput {
  return { OR: [{ managerId: me }, { dottedManagerId: me }] }
}

/** Everyone under `me`: solid-line reports at any depth plus dotted reports; never `me`,
 *  and safe against cycles in bad org data. */
export function reportingLine(me: string, employees: ReportingRow[]): string[] {
  const byManager = new Map<string, string[]>()
  for (const e of employees) {
    if (!e.managerId) continue
    byManager.set(e.managerId, [...(byManager.get(e.managerId) ?? []), e.id])
  }
  const seen = new Set<string>([me])
  const queue = [me]
  while (queue.length) {
    const next = queue.shift()!
    for (const id of byManager.get(next) ?? []) {
      if (seen.has(id)) continue
      seen.add(id)
      queue.push(id)
    }
  }
  for (const e of employees) if (e.dottedManagerId === me) seen.add(e.id)
  seen.delete(me)
  return Array.from(seen)
}
