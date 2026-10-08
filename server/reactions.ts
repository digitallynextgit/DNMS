import "server-only"

// Grouped on the server so bubbles don't re-group on every render. Names are capped for a readable
// tooltip; `count` keeps the real total.
const MAX_NAMES = 8

export interface ReactionRow {
  emoji: string
  employeeId: string
  employee: { firstName: string; lastName: string } | null
}

export interface ReactionGroup {
  emoji: string
  count: number
  mine: boolean
  names: string[]
}

export function groupReactions(rows: ReactionRow[], viewerId: string): ReactionGroup[] {
  const byEmoji = new Map<string, ReactionGroup>()
  for (const r of rows) {
    const g = byEmoji.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false, names: [] }
    g.count++
    if (r.employeeId === viewerId) g.mine = true
    if (g.names.length < MAX_NAMES) {
      g.names.push(
        r.employeeId === viewerId
          ? "You"
          : `${r.employee?.firstName ?? ""} ${r.employee?.lastName ?? ""}`.trim() || "Someone",
      )
    }
    byEmoji.set(r.emoji, g)
  }
  return [...byEmoji.values()].sort((a, b) => b.count - a.count)
}
