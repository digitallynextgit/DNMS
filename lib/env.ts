// =============================================================================
// Validated environment variables (CLAUDE.md §4)
// =============================================================================
// Parsed lazily so importing this module never crashes a process that doesn't
// need a given var. Call `getEnv()` where you want fail-fast validation, or read
// `env` for the eager singleton. Schema mirrors .env.example — required vars are
// the minimum to boot; integrations are optional and validated when present.
// =============================================================================

import { z } from "zod"

const schema = z.object({
  // Core
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_NAME: z.string().default("HRMS"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  NEXTAUTH_URL: z.string().url().optional(),

  // Auth providers (optional)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Storage (optional)
  REDIS_URL: z.string().optional(),
  MINIO_ENDPOINT: z.string().optional(),
  MINIO_BUCKET: z.string().optional(),

  // Email (optional)
  SMTP_HOST: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // Secrets / integrations (optional)
  ENCRYPTION_KEY: z.string().optional(),
  CAREERS_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
})

export type Env = z.infer<typeof schema>

let cached: Env | null = null

export function getEnv(): Env {
  if (!cached) cached = schema.parse(process.env)
  return cached
}

export const env = new Proxy({} as Env, {
  get: (_t, key: string) => getEnv()[key as keyof Env],
})
