function withParams(base: string, params: Record<string, string | null | undefined>): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value) qs.set(key, value)
  const s = qs.toString()
  return s ? `${base}?${s}` : base
}

/**
 * Project page link: the slug, falling back to the id for rows created before slugs. `extra`
 * opens one item on the tab (task, team, thread, reply, site, report, calendar, folder).
 */
export function projectHref(
  project: { id: string; slug?: string | null },
  tab?: string,
  extra: Record<string, string | null | undefined> = {},
): string {
  return withParams(`/projects/${project.slug || project.id}`, { tab, ...extra })
}

/**
 * A task on the My Work sheet: the week it is due (any day opens that week) and, when it isn't
 * the reader's own, whose sheet. Undated tasks show in every week, so they need no week.
 */
export function myWorkHref(
  task: { dueDate?: Date | string | null } = {},
  personId?: string | null,
): string {
  const week = task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : null
  return withParams("/projects/my-work", { person: personId, week })
}
