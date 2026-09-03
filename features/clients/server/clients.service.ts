import "server-only"

import { Prisma } from "@prisma/client"
import type { Session } from "next-auth"
import { db } from "@/server/db"
import { slugify } from "@/lib/utils"
import { createAuditLog } from "@/lib/audit"
import {
  ok,
  fail,
  runAction,
  serialize,
  ActionError,
  type ActionResult,
} from "@/server/action-result"
import {
  clientCreateSchema,
  clientUpdateSchema,
  type ClientUpdateInput,
} from "../schemas/client.schema"

// =============================================================================
// Writes for the client book: the company itself. Its people (portal logins)
// and what they may see are the client-portal feature's business - see
// features/client-portal/server/client-contacts.service.ts.
// =============================================================================

/** Empty string -> null, so a field cleared in the form clears the column. */
const nullable = (v: string | null | undefined): string | null => {
  const t = v?.trim()
  return t ? t : null
}

/** The account manager must be a real, active employee. Null is "nobody yet". */
async function assertOwner(ownerId: string | null | undefined): Promise<string | null> {
  if (!ownerId) return null
  const emp = await db.employee.findUnique({
    where: { id: ownerId },
    select: { id: true, isActive: true },
  })
  if (!emp) throw new ActionError("Account manager not found", 422)
  if (!emp.isActive) throw new ActionError("Account manager is not an active employee", 422)
  return emp.id
}

/**
 * "Acme Studios" -> "acme-studios", with "-2", "-3"… on a collision. The same
 * rule as project slugs, and like them generated ONCE: a slug that moved on
 * rename would break every link already shared.
 */
async function generateClientSlug(name: string, fallback: string): Promise<string> {
  const base = slugify(name) || slugify(fallback)
  const taken = await db.client.findMany({
    where: { OR: [{ slug: base }, { slug: { startsWith: `${base}-` } }] },
    select: { slug: true },
  })
  if (!taken.some((c) => c.slug === base)) return base
  const used = new Set(taken.map((c) => c.slug))
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`
    if (!used.has(candidate)) return candidate
  }
  return slugify(fallback)
}

/**
 * CL00001, CL00002… Fixed width and zero-padded, so the lexicographically
 * highest code is the numerically highest one and the database can find it.
 * `attempt` nudges past a slot another create took in the same instant.
 */
async function nextCode(attempt: number): Promise<string> {
  const last = await db.client.findFirst({
    where: { code: { startsWith: "CL" } },
    select: { code: true },
    orderBy: { code: "desc" },
  })
  const match = last?.code.match(/^CL(\d+)$/)
  const max = match ? parseInt(match[1] ?? "0", 10) : 0
  return `CL${(max + 1 + attempt).toString().padStart(5, "0")}`
}

/** The optional columns, applied only when the input names them. */
function optionalColumns(input: ClientUpdateInput): Prisma.ClientUncheckedUpdateInput {
  const data: Prisma.ClientUncheckedUpdateInput = {}
  if (input.industry !== undefined) data.industry = nullable(input.industry)
  if (input.website !== undefined) data.website = nullable(input.website)
  if (input.email !== undefined) data.email = nullable(input.email)
  if (input.phone !== undefined) data.phone = nullable(input.phone)
  if (input.address !== undefined) data.address = nullable(input.address)
  if (input.taxId !== undefined) data.taxId = nullable(input.taxId)
  if (input.notes !== undefined) data.notes = nullable(input.notes)
  return data
}

const SUMMARY_SELECT = { id: true, name: true, code: true, slug: true, status: true } as const

export async function createClient(
  body: unknown,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = clientCreateSchema.parse(body)
    const ownerId = await assertOwner(input.ownerId)
    const optional = optionalColumns(input)

    // Retry on the unique-violation race: two concurrent creates compute the
    // same next code, and the loser should get the next one, not a 500.
    for (let attempt = 0; ; attempt++) {
      const code = await nextCode(attempt)
      try {
        const client = await db.client.create({
          data: {
            ...(optional as Prisma.ClientUncheckedCreateInput),
            name: input.name,
            status: input.status,
            code,
            slug: await generateClientSlug(input.name, code),
            ownerId,
            createdById: session.user.id,
          },
          select: SUMMARY_SELECT,
        })
        await createAuditLog(session, {
          action: "CREATE",
          module: "client",
          entityType: "Client",
          entityId: client.id,
          changes: { name: client.name, code: client.code, status: client.status },
        })
        return ok(serialize(client))
      } catch (e) {
        if ((e as { code?: string }).code === "P2002" && attempt < 5) continue
        throw e
      }
    }
  })
}

export async function updateClient(
  id: string,
  body: unknown,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = clientUpdateSchema.parse(body)
    const existing = await db.client.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return fail("Client not found", undefined, 404)

    const data = optionalColumns(input)
    if (input.name !== undefined) data.name = input.name
    if (input.status !== undefined) data.status = input.status
    if (input.ownerId !== undefined) data.ownerId = await assertOwner(input.ownerId)

    const client = await db.client.update({ where: { id }, data, select: SUMMARY_SELECT })
    await createAuditLog(session, {
      action: "UPDATE",
      module: "client",
      entityType: "Client",
      entityId: id,
      changes: input,
    })
    return ok(serialize(client))
  })
}

/**
 * Delete a client - only one with nothing hanging off it.
 *
 * A client with projects or portal logins is a record of work done and people
 * given access; the honest way to retire that is status INACTIVE, which keeps
 * every link intact. Refusing here rather than cascading is what makes the
 * SetNull foreign keys safe: they exist for the database's sake, not as a path.
 */
export async function deleteClient(id: string, session: Session): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const client = await db.client.findUnique({
      where: { id },
      select: { name: true, _count: { select: { projects: true, contacts: true } } },
    })
    if (!client) return fail("Client not found", undefined, 404)
    if (client._count.projects > 0 || client._count.contacts > 0) {
      return fail(
        "This client still has projects or contacts. Move them first, or mark the client inactive instead.",
        undefined,
        409,
      )
    }
    await db.client.delete({ where: { id } })
    await createAuditLog(session, {
      action: "DELETE",
      module: "client",
      entityType: "Client",
      entityId: id,
      changes: { name: client.name },
    })
    return ok(serialize({ id }))
  })
}
