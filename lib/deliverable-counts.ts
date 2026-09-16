import "server-only"

import { db } from "@/server/db"

// =============================================================================
// Keeping "Made" in step with what has actually been handed over.
//
// `deliveredQuantity` used to move only when staff logged a delivery. Attaching
// a file - which is how work is handed over in the portal, and increasingly on
// the staff side too - left it alone, so a row could read "Made 0 of 8" beside
// eight uploaded posters. The count and the evidence disagreed, and the evidence
// was right.
//
// Lives in lib/ because BOTH the client portal and the staff resources route
// attach files to the same deliverables and must move the count the same way.
// A second, subtly different rule on one side is how the two drift apart again.
// =============================================================================

/**
 * Move Made to match a change in the number of attachments.
 *
 * A FLOOR, not an equals. Staff legitimately record work that was made but never
 * uploaded, so the stored figure can run ahead of the attachments - 6 rows did
 * when this was written - and removing a file must not silently erase that. So:
 *
 *   - a count already ahead of the attachments is left exactly where it is;
 *   - a count that was tracking them follows them, down as well as up.
 *
 * `before` and `after` are the attachment totals (files + links) either side of
 * the change. Capped at the row's quantity: "9 of 8 made" is not a thing.
 */
export async function syncMadeCount(
  item: { id: string; quantity: number },
  before: number,
  after: number,
): Promise<void> {
  const row = await db.projectDeliverable.findUnique({
    where: { id: item.id },
    select: { deliveredQuantity: true },
  })
  if (!row) return
  // Ahead of the attachments already => somebody put it there deliberately.
  if (row.deliveredQuantity > before) return

  const next = Math.max(0, Math.min(item.quantity, after))
  if (next === row.deliveredQuantity) return
  await db.projectDeliverable.update({
    where: { id: item.id },
    data: { deliveredQuantity: next },
  })
}

/**
 * Everything handed over against one deliverable: every attached file, plus
 * pasted links.
 *
 * Counts files the client CANNOT see as well as ones they can. That is
 * deliberate and is the difference between this and the portal's capacity rule:
 * "how much has been made" is a question about the work, and a reel the team has
 * produced but not yet shared has still been made. "How many slots has the
 * client filled" is a different question, and the portal counts only its own
 * visible attachments for that.
 *
 * Both sides must call THIS for the Made count, or their idea of `before` and
 * `after` diverges and the floor logic in syncMadeCount stops meaning anything.
 */
export async function attachmentCount(deliverableId: string): Promise<number> {
  const row = await db.projectDeliverable.findUnique({
    where: { id: deliverableId },
    select: { links: true, _count: { select: { files: true } } },
  })
  return row ? row._count.files + row.links.length : 0
}
