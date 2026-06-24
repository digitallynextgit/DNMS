import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
  pgPool?: Pool
}

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

function createClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg(getPool()),
    log: ["error", "warn"],
  })
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
