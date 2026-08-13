// =============================================================================
// Client portal reads
// =============================================================================
// Everything a signed-in CLIENT can fetch. Two invariants hold in every function
// here, and nothing in this file may be written that breaks them:
//
//   1. The project reference is never trusted from the request. It arrives as a
//      SLUG and is resolved by requireClientModule, which proves the grant and
//      the module and hands back the real id. Every `where` below filters on
//      `grant.projectId` - filtering on the slug would silently match nothing.
//   2. `select` is always explicit and hand-written. No `include`, no spreading
//      a Prisma row into a response. Internal columns (a channel's encrypted
//      credentials, sync errors, cost fields) must not be one careless
//      `include` away from a client's browser.
// =============================================================================

import "server-only"

import { db } from "@/server/db"
import { ok, runAction, serialize, type ActionResult } from "@/server/action-result"
import {
  requireClientSession,
  requireClientModule,
  requireClientProject,
  listClientGrants,
} from "@/server/client-guard"
import type { ProductListQuery } from "../schemas/client-portal.schema"

/** The portal landing payload: who they are + which projects they hold. */
export async function getClientOverview(): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireClientSession()
    const grants = await listClientGrants(session.user.id)

    return ok(
      serialize({
        data: {
          name: session.user.firstName,
          email: session.user.email,
          company: session.user.company,
          projects: grants,
        },
      }),
    )
  })
}

/** One project's header + the modules this client's package unlocks on it. */
export async function getClientProject(projectRef: string): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireClientSession()
    const grant = await requireClientProject(session.user.id, projectRef)
    return ok(serialize({ data: grant }))
  })
}

const PRODUCT_CARD_SELECT = {
  id: true,
  title: true,
  sku: true,
  imageUrl: true,
  vendor: true,
  category: true,
  price: true,
  compareAtPrice: true,
  currency: true,
  inventoryQty: true,
  status: true,
  tags: true,
  url: true,
  lastSyncedAt: true,
  channel: { select: { id: true, name: true, provider: true } },
} as const

/** Paginated product catalog for one project. Requires the "products" module. */
export async function listClientProducts(
  projectRef: string,
  query: ProductListQuery,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const { grant } = await requireClientModule(projectRef, "products")
    const projectId = grant.projectId

    const { search, status, channelId, page, pageSize } = query
    const where = {
      projectId,
      ...(status ? { status } : {}),
      ...(channelId ? { channelId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" as const } },
              { sku: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    }

    const [items, total] = await Promise.all([
      db.product.findMany({
        where,
        select: PRODUCT_CARD_SELECT,
        orderBy: { title: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.product.count({ where }),
    ])

    return ok(
      serialize({
        data: items,
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 },
      }),
    )
  })
}

/** A single product's detail. Requires the "products" module. */
export async function getClientProduct(
  projectRef: string,
  productId: string,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const { grant } = await requireClientModule(projectRef, "products")
    const projectId = grant.projectId

    const product = await db.product.findFirst({
      // projectId in the WHERE, not just the id: without it, any product id
      // guessed from another project would resolve.
      where: { id: productId, projectId },
      select: { ...PRODUCT_CARD_SELECT, description: true },
    })
    if (!product) return ok(serialize({ data: null }))

    return ok(serialize({ data: product }))
  })
}

/**
 * The project's sales channels. Requires the "channels" module.
 * Note the select: `credentials`, `lastSyncError` and `externalId` are
 * deliberately absent - a client sees that a channel exists and whether it is
 * live, never how we connect to it.
 */
export async function listClientChannels(projectRef: string): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const { grant } = await requireClientModule(projectRef, "channels")
    const projectId = grant.projectId

    const channels = await db.marketplaceChannel.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        provider: true,
        status: true,
        lastSyncedAt: true,
        _count: { select: { products: true } },
      },
      orderBy: { name: "asc" },
    })

    return ok(serialize({ data: channels }))
  })
}

/** Stock summary + the products that need attention. Requires "inventory". */
export async function getClientInventory(projectRef: string): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const { grant } = await requireClientModule(projectRef, "inventory")
    const projectId = grant.projectId

    const LOW_STOCK_AT = 5

    const [total, outOfStock, lowStock, attention] = await Promise.all([
      db.product.count({ where: { projectId } }),
      db.product.count({ where: { projectId, inventoryQty: { lte: 0 } } }),
      db.product.count({
        where: { projectId, inventoryQty: { gt: 0, lte: LOW_STOCK_AT } },
      }),
      db.product.findMany({
        where: { projectId, inventoryQty: { lte: LOW_STOCK_AT } },
        select: {
          id: true,
          title: true,
          sku: true,
          imageUrl: true,
          inventoryQty: true,
          channel: { select: { name: true } },
        },
        orderBy: { inventoryQty: "asc" },
        take: 50,
      }),
    ])

    return ok(
      serialize({
        data: { total, outOfStock, lowStock, lowStockThreshold: LOW_STOCK_AT, attention },
      }),
    )
  })
}
