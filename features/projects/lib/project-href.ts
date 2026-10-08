/** Project page link: the slug, falling back to the id for rows created before slugs. */
export function projectHref(project: { id: string; slug?: string | null }, tab?: string): string {
  const base = `/projects/${project.slug || project.id}`
  return tab ? `${base}?tab=${tab}` : base
}
