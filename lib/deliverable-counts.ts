import "server-only"

import { db } from "@/server/db"

// Shared by the client portal and the staff resources route so both move "Made" the same way.

/**
 * Move Made to follow a change in attachments (files + links). A floor, not an equals: a count
 * already ahead of the attachments is left alone. Capped at the row's quantity.
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
  // Already ahead of the attachments => set deliberately.
  if (row.deliveredQuantity > before) return

  const next = Math.max(0, Math.min(item.quantity, after))
  if (next === row.deliveredQuantity) return
  await db.projectDeliverable.update({
    where: { id: item.id },
    data: { deliveredQuantity: next },
  })
}

/**
 * Files (including ones the client can't see) plus pasted links. Both sides must use this for Made,
 * or `before`/`after` diverge. The portal's capacity rule counts only client-visible files.
 */
export async function attachmentCount(deliverableId: string): Promise<number> {
  const row = await db.projectDeliverable.findUnique({
    where: { id: deliverableId },
    select: { links: true, _count: { select: { files: true } } },
  })
  return row ? row._count.files + row.links.length : 0
}
