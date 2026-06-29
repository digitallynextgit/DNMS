/** Format decimal hours as "Hh Mm" (e.g. 1.5 -> "1h 30m", 0.25 -> "15m"). */
export function formatHours(h: number): string {
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  if (hrs === 0) return `${mins}m`
  if (mins === 0) return `${hrs}h`
  return `${hrs}h ${mins}m`
}
