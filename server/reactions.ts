import "server-only"

/**
 * Reaction rows → what a bubble renders.
 *
 * Done on the SERVER so a message carries its reactions already grouped: the
 * alternative is every bubble re-grouping the same rows on every render, which
 * is once per message per keystroke in the composer above it.
 *
 * Names are capped: a 40-person "👍" needs a tooltip you can read, and `count`
 * still carries the real total so the chip never lies.
 */
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
  // Most-reacted first, so the chip people are actually piling onto leads.
  return [...byEmoji.values()].sort((a, b) => b.count - a.count)
}
