/**
 * The canonical link to a client page.
 *
 * Prefers the slug (/projects/clients/acme-studios) and falls back to the id,
 * the same rule projectHref applies, so the two families of URL never drift.
 */
export function clientHref(client: { id: string; slug?: string | null }, tab?: string): string {
  const base = `/projects/clients/${client.slug || client.id}`
  return tab ? `${base}?tab=${tab}` : base
}
