import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { tenantGuard } from "./tenant-guard"

function getPool(): Pool {
  if (globalForPrisma.pgPool) return globalForPrisma.pgPool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Server max_connections is 100: 20 per instance leaves room for ~4 instances plus
    // migrations and psql. Set DB_POOL_MAX if you run more instances.
    max: Number(process.env.DB_POOL_MAX) || (process.env.NODE_ENV === "production" ? 20 : 5),
    idleTimeoutMillis: 30_000,
    // Fail fast instead of queueing forever when every connection is busy.
    connectionTimeoutMillis: 5_000,
    keepAlive: true,
  })
  if (process.env.NODE_ENV !== "production") globalForPrisma.pgPool = pool
  return pool
}

// Return type inferred on purpose: the `omit` below lives in the client's TYPE, and a
// `PrismaClient` annotation would erase it.
function createClient() {
  return new PrismaClient({
    adapter: new PrismaPg(getPool()),
    log: process.env.PRISMA_LOG_QUERIES === "1" ? ["query", "error", "warn"] : ["error", "warn"],
    // Credentials are deny-by-default: stripped from every query unless a caller opts back in
    // (`omit: { field: false }` or an explicit select).
    omit: {
      user: { passwordHash: true },
      employee: { passwordHash: true, gmailAppPassword: true },
      clientUser: { passwordHash: true },
    },
  })
}

// The only client in the app is the tenant-guarded one; cross-tenant work uses runUnscoped().
function createGuardedClient() {
  return createClient().$extends(tenantGuard)
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createGuardedClient>
  pgPool?: Pool
}

export const db = globalForPrisma.prisma ?? createGuardedClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db

/** Type for a `tx` param: the extended client no longer matches Prisma.TransactionClient. */
export type DbTransaction = Parameters<Parameters<typeof db.$transaction>[0]>[0]
