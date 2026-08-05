/**
 * The canonical link to a project page.
 *
 * Prefers the slug (/projects/rudione-leocym) and falls back to the id for rows
 * created before slugs existed. One helper rather than a `slug ?? id` at every
 * call site, so the rule can never drift between the list, My Tasks and Progress.
 */
export function projectHref(project: { id: string; slug?: string | null }, tab?: string): string {
  const base = `/projects/${project.slug || project.id}`
  return tab ? `${base}?tab=${tab}` : base
}
