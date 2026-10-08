/** Canonical client link: the slug when there is one, else the id (same rule as projectHref). */
export function clientHref(client: { id: string; slug?: string | null }, tab?: string): string {
  const base = `/projects/clients/${client.slug || client.id}`
  return tab ? `${base}?tab=${tab}` : base
}
