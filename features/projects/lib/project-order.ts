// The default order of the projects list: the work that matters most first.

/** Live work first; finished work last. */
const STATUS_RANK: Record<string, number> = {
  ACTIVE: 0,
  ON_HOLD: 1,
  PLANNING: 2,
  COMPLETED: 3,
  CANCELLED: 4,
}

const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

export interface RankedProject {
  name: string
  status: string
  priority: string
  /** Workload: busier projects first. */
  taskCount: number
}

/** Status, then priority, then workload, then name. */
export function compareProjectImportance(a: RankedProject, b: RankedProject): number {
  return (
    (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) ||
    (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) ||
    b.taskCount - a.taskCount ||
    a.name.localeCompare(b.name)
  )
}
