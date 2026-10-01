export interface ReportingRow {
  id: string
  managerId: string | null
  dottedManagerId: string | null
}

/**
 * Everyone under `me`: solid-line reports at any depth (a manager of managers
 * sees the whole branch), plus people who have `me` as their dotted-line
 * manager. Never includes `me`, and survives a cycle in bad org data.
 */
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
