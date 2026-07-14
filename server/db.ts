import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

function getPool(): Pool {
  if (globalForPrisma.pgPool) return globalForPrisma.pgPool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: process.env.NODE_ENV === "production" ? 10 : 5,
    idleTimeoutMillis: 30_000,
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
    },
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>
  pgPool?: Pool
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
