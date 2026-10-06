// =============================================================================
// Departments form a tree: Department → Sub-department → Sub-sub-department,
// e.g. SMG → MSG → Content. Each row points at its parent (Department.parentId).
//
// Pure functions, no imports: the service validates moves with them and every
// department dropdown orders and labels itself with them, so the two can never
// disagree about what the tree looks like.
// =============================================================================

/** How many levels deep the tree may go. */
export const MAX_DEPARTMENT_DEPTH = 3

/** What each level is called, by depth (0 = top level). */
export const DEPARTMENT_LEVEL_LABELS = ["Department", "Sub-department", "Sub-sub-department"]

export interface DepartmentNode {
  id: string
  name: string
  parentId: string | null
}

export type FlatDepartment<T extends DepartmentNode> = T & {
  /** 0 for a top-level department. */
  depth: number
  /** Names from the top level down to this one. */
  path: string[]
  /** The path as one line - what a dropdown shows: "SMG › MSG › Content". */
  label: string
  /** Outline number in tree order: "1", "1.2", "1.2.1". */
  outline: string
  /** How many direct sub-departments it has (in `list`). */
  childCount: number
}

/**
 * The tree, flattened depth-first: every department followed by its
 * sub-departments, siblings alphabetical.
 *
 * A department whose parent is not in `list` (an inactive parent filtered out,
 * say) is shown as top level rather than dropped. A parent loop - which the
 * service refuses to create - is unreachable from the top and left out,
 * rather than recursed into forever.
 */
export function flattenDepartmentTree<T extends DepartmentNode>(list: T[]): FlatDepartment<T>[] {
  const ids = new Set(list.map((d) => d.id))
  const byParent = new Map<string | null, T[]>()
  for (const d of list) {
    const key = d.parentId && ids.has(d.parentId) && d.parentId !== d.id ? d.parentId : null
    const siblings = byParent.get(key)
    if (siblings) siblings.push(d)
    else byParent.set(key, [d])
  }
  for (const siblings of byParent.values()) siblings.sort((a, b) => a.name.localeCompare(b.name))

  const out: FlatDepartment<T>[] = []
  const seen = new Set<string>()
  const walk = (parentId: string | null, depth: number, path: string[], outline: string) => {
    ;(byParent.get(parentId) ?? []).forEach((d, i) => {
      if (seen.has(d.id)) return
      seen.add(d.id)
      const ownPath = [...path, d.name]
      const ownOutline = outline ? `${outline}.${i + 1}` : String(i + 1)
      out.push({
        ...d,
        depth,
        path: ownPath,
        label: ownPath.join(" › "),
        outline: ownOutline,
        childCount: byParent.get(d.id)?.length ?? 0,
      })
      walk(d.id, depth + 1, ownPath, ownOutline)
    })
  }
  walk(null, 0, [], "")
  return out
}

/** Every department below `id`, at any depth (not including `id` itself). */
export function departmentDescendantIds(
  list: ReadonlyArray<Pick<DepartmentNode, "id" | "parentId">>,
  id: string,
): Set<string> {
  const byParent = new Map<string, string[]>()
  for (const d of list) {
    if (!d.parentId) continue
    const kids = byParent.get(d.parentId)
    if (kids) kids.push(d.id)
    else byParent.set(d.parentId, [d.id])
  }
  const out = new Set<string>()
  const stack = [...(byParent.get(id) ?? [])]
  while (stack.length > 0) {
    const next = stack.pop()!
    if (next === id || out.has(next)) continue
    out.add(next)
    stack.push(...(byParent.get(next) ?? []))
  }
  return out
}

/** Depth of `id` in the tree: 0 for a top-level department. */
export function departmentDepth(
  list: ReadonlyArray<Pick<DepartmentNode, "id" | "parentId">>,
  id: string,
): number {
  const parentOf = new Map(list.map((d) => [d.id, d.parentId]))
  let depth = 0
  let cur = parentOf.get(id) ?? null
  const seen = new Set([id])
  while (cur && !seen.has(cur) && parentOf.has(cur)) {
    seen.add(cur)
    depth++
    cur = parentOf.get(cur) ?? null
  }
  return depth
}

/** How many levels `id` and everything under it span: 1 for a department with no subs. */
export function departmentSubtreeHeight(
  list: ReadonlyArray<Pick<DepartmentNode, "id" | "parentId">>,
  id: string,
): number {
  const below = departmentDescendantIds(list, id)
  let height = 1
  const base = departmentDepth(list, id)
  for (const d of below) height = Math.max(height, departmentDepth(list, d) - base + 1)
  return height
}

/**
 * Why `id` cannot sit under `parentId`, or null when it can.
 *
 * Pass `id = null` for a department that does not exist yet. Refuses a parent
 * that is the department itself or one of its own sub-departments (a loop),
 * and any move that would push the department - or the deepest thing under
 * it - past MAX_DEPARTMENT_DEPTH levels.
 */
export function departmentParentError(
  list: ReadonlyArray<Pick<DepartmentNode, "id" | "parentId">>,
  id: string | null,
  parentId: string | null,
): string | null {
  if (!parentId) return null
  if (!list.some((d) => d.id === parentId)) return "Parent department not found"
  if (id && (parentId === id || departmentDescendantIds(list, id).has(parentId)))
    return "A department cannot sit under itself or one of its own sub-departments"
  const height = id ? departmentSubtreeHeight(list, id) : 1
  if (departmentDepth(list, parentId) + 1 + height > MAX_DEPARTMENT_DEPTH)
    return `Departments go ${MAX_DEPARTMENT_DEPTH} levels deep at most (department › sub-department › sub-sub-department)`
  return null
}
