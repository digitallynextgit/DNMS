import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

function getPool(): Pool {
  if (globalForPrisma.pgPool) return globalForPrisma.pgPool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Raised from 10 now that the endpoints which used to hold many connections
    // at once are bounded (the storage overview ran 12 unbounded scans in one
    // Promise.all - it now runs 3 at a time).
    //
    // Sized against the server's actual limit: max_connections=100 with 3
    // superuser-reserved, so 20 per instance leaves room for ~4 app instances
    // plus migrations, psql sessions and the cron worker. Override with
    // DB_POOL_MAX if you run more instances than that.
    max: Number(process.env.DB_POOL_MAX) || (process.env.NODE_ENV === "production" ? 20 : 5),
    idleTimeoutMillis: 30_000,
    // Fail fast instead of queueing forever when every connection is busy (e.g. a
    // long backfill pinning the pool) - a stuck request is better than a stalled app.
    connectionTimeoutMillis: 5_000,
    keepAlive: true,
  })
  if (process.env.NODE_ENV !== "production") globalForPrisma.pgPool = pool
  return pool
}

// NOTE: the return type is inferred, not annotated as `PrismaClient`. The `omit`
// config below is encoded in the client's TYPE, so annotating it would erase that
// and let `employee.passwordHash` type-check as if it were still there.
function createClient() {
  return new PrismaClient({
    adapter: new PrismaPg(getPool()),
    log: ["error", "warn"],
    // Credentials are DENY-BY-DEFAULT: Prisma strips these from every query, so a
    // `findMany`/`include` without an explicit `select` can never leak them into an
    // API response. The three places that legitimately need them opt back in with
    // `omit: { <field>: false }`:
    //   - server/auth.ts        (bcrypt.compare on login)
    //   - app/api/profile/route.ts (verify current password; read app password)
    //   - lib/mailer.ts         (decrypt the Gmail app password to send as the user)
    omit: {
      employee: { passwordHash: true, gmailAppPassword: true },
      // Same deny-by-default for external client accounts; only the client
      // credentials provider in server/auth.ts opts back in.
      clientUser: { passwordHash: true },
    },
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>
  pgPool?: Pool
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
