# Next.js Project Standard (Feature-Based)

> **For AI agents (Claude Code, Cursor, Copilot, etc.):** This file is the source of truth for
> how every Next.js project in this organization is structured. When scaffolding, refactoring, or
> adding code, FOLLOW THESE RULES EXACTLY. Do not invent alternative structures.
>
> **To activate in a project:** copy this file into the project root and rename it to `CLAUDE.md`
> (Claude Code), `AGENTS.md` (Codex/others), or `.cursorrules` (Cursor). All three are auto-read.

## Stack (assume this unless the project says otherwise)

- Next.js (App Router) + TypeScript (strict)
- Prisma (PostgreSQL)
- Tailwind CSS v4 + shadcn/ui
- TanStack Query (client data) + Zod (validation)
- Auth.js (NextAuth) or Lucia
- pnpm as package manager

---

## 1. Folder structure

Everything lives under `src/`. `app/` is for routing ONLY. All real logic lives in `features/`.

```
src/
├── app/                          # ROUTING ONLY — keep thin
│   ├── (marketing)/              # route group: public pages
│   ├── (dashboard)/              # route group: authed app
│   │   └── projects/
│   │       ├── page.tsx          # imports from @/features/projects
│   │       ├── loading.tsx
│   │       └── error.tsx
│   ├── api/                      # backend route handlers (thin)
│   │   └── projects/route.ts
│   ├── layout.tsx                # root layout
│   ├── error.tsx                 # route-segment error boundary
│   ├── global-error.tsx          # root error boundary
│   ├── not-found.tsx             # 404
│   ├── loading.tsx
│   └── globals.css
│
├── features/                     # ⭐ ONE FOLDER PER DOMAIN
│   └── <feature>/
│       ├── components/           # feature-only UI
│       ├── server/               # server-only logic
│       │   ├── <feature>.actions.ts    # "use server" actions
│       │   ├── <feature>.service.ts     # business logic (DB, side effects)
│       │   └── <feature>.queries.ts     # data reads
│       ├── hooks/                # client hooks (TanStack Query etc.)
│       ├── schemas/              # zod schemas
│       ├── types.ts
│       ├── constants.ts
│       └── index.ts              # PUBLIC API — only this is imported elsewhere
│
├── components/                   # SHARED UI (used by 2+ features)
│   ├── ui/                       # shadcn/ui primitives
│   ├── layout/                   # navbar, sidebar, footer
│   └── providers/                # QueryProvider, ThemeProvider…
│
├── lib/                          # framework-agnostic helpers
│   ├── errors.ts                 # custom error classes
│   ├── api-response.ts           # standard API response shape
│   ├── utils.ts                  # cn(), formatters…
│   ├── env.ts                    # validated env (zod)
│   └── logger.ts
│
├── server/                       # shared server infra
│   ├── db.ts                     # Prisma singleton
│   ├── auth.ts                   # auth config
│   └── api-handler.ts            # withErrorHandler wrapper
│
├── hooks/                        # shared client hooks
├── config/                       # site.ts, nav.ts, constants
├── types/                        # global TS types
└── styles/

prisma/        # schema.prisma, migrations/, seed.ts
public/
emails/        # react-email templates
docs/          # PRD, architecture notes
```

---

## 2. The 4 non-negotiable rules

1. **`app/` is routing glue only.** A `page.tsx` imports a component from a feature and renders
   it. NO business logic, NO direct DB calls in pages or layouts.
2. **Cross-feature imports go through the barrel.** Import `@/features/projects` (its `index.ts`),
   NEVER `@/features/projects/server/projects.service`. The `index.ts` is the feature's public API;
   internals stay private and refactorable.
3. **`server/` code never runs on the client.** Put `import "server-only";` at the top of every
   service/query file so a wrong import fails the build instead of leaking secrets.
4. **Shared vs feature:** used by ONE feature → keep it inside that feature. Used by 2+ → promote to
   `src/components`, `src/lib`, or `src/hooks`. Never pre-share.

### Naming conventions

- Files: `kebab-case.ts` (e.g. `auth.service.ts`, `use-projects.ts`).
- React components: `PascalCase` export, file named `kebab-case.tsx` or `PascalCase.tsx` (be
  consistent per project).
- Server actions end in `.actions.ts`, services in `.service.ts`, queries in `.queries.ts`.
- Zod schemas end in `.schema.ts` and export `xxxSchema`.

---

## 3. Standard error handling

### `src/lib/errors.ts`

```ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = "INTERNAL_ERROR",
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = this.constructor.name
  }
}
export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, 404, "NOT_FOUND")
  }
}
export class UnauthorizedError extends AppError {
  constructor(message = "Not authenticated") {
    super(message, 401, "UNAUTHORIZED")
  }
}
export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super(message, 403, "FORBIDDEN")
  }
}
export class ValidationError extends AppError {
  constructor(message = "Invalid input", details?: unknown) {
    super(message, 422, "VALIDATION_ERROR", details)
  }
}
```

### `src/lib/api-response.ts`

```ts
import { NextResponse } from "next/server"

type Success<T> = { success: true; data: T }
type Failure = { success: false; error: { code: string; message: string; details?: unknown } }

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<Success<T>>({ success: true, data }, init)
}
export function fail(code: string, message: string, status = 400, details?: unknown) {
  return NextResponse.json<Failure>(
    { success: false, error: { code, message, details } },
    { status },
  )
}
```

### `src/server/api-handler.ts`

```ts
import { ZodError } from "zod"
import { AppError } from "@/lib/errors"
import { fail } from "@/lib/api-response"

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>

export function withErrorHandler(handler: Handler): Handler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx)
    } catch (err) {
      if (err instanceof ZodError)
        return fail("VALIDATION_ERROR", "Invalid input", 422, err.flatten())
      if (err instanceof AppError) return fail(err.code, err.message, err.statusCode, err.details)
      console.error("[UNHANDLED]", err)
      return fail("INTERNAL_ERROR", "Something went wrong", 500)
    }
  }
}
```

**Every API route MUST use `withErrorHandler` and return `ok()` / `fail()`.** Example:

```ts
import { withErrorHandler } from "@/server/api-handler"
import { ok } from "@/lib/api-response"
import { listProjects } from "@/features/projects"

export const GET = withErrorHandler(async () => ok(await listProjects()))
```

### Frontend error files (App Router) — create these in `src/app/`

- `error.tsx` — route-segment boundary (`"use client"`, has `reset()`).
- `global-error.tsx` — root boundary, renders its own `<html><body>`.
- `not-found.tsx` — 404.
- `loading.tsx` — Suspense fallback.

Also add `error.tsx` + `loading.tsx` inside major route folders (e.g. `app/(dashboard)/projects/`)
so one section failing doesn't blank the whole app.

```tsx
// src/app/error.tsx
"use client"
import { useEffect } from "react"
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground text-sm">{error.message || "Please try again."}</p>
      <button onClick={reset} className="bg-primary text-primary-foreground rounded-md px-4 py-2">
        Try again
      </button>
    </div>
  )
}
```

---

## 4. Shared infra files

### `src/lib/env.ts` — validate env at boot (fail fast)

```ts
import { z } from "zod"
const schema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
})
export const env = schema.parse(process.env)
```

### `src/server/db.ts` — Prisma singleton

```ts
import { PrismaClient } from "@prisma/client"
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"] })
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
```

---

## 5. Config files (create all of these at project root)

### `tsconfig.json` (key parts)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "bundler",
    "module": "esnext",
    "jsx": "preserve",
    "noEmit": true,
    "incremental": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### `.prettierignore`

```
node_modules
.next
out
build
dist
coverage
pnpm-lock.yaml
package-lock.json
*.md
prisma/migrations
public
```

### `.gitignore`

```gitignore
# dependencies
/node_modules
.pnp
.pnp.*
.yarn/*

# next.js
/.next/
/out/
next-env.d.ts

# production
/build
/dist

# testing
/coverage

# env files — NEVER commit
.env
.env*.local
.env.development
.env.production
!.env.example

# prisma
/prisma/*.db
/prisma/*.db-journal

# logs
*.log
npm-debug.log*
pnpm-debug.log*
yarn-debug.log*
yarn-error.log*

# os / editor
.DS_Store
Thumbs.db
*.pem
.idea
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json

# misc
/tmp
.turbo
.vercel
*.tsbuildinfo
```

### `.env.example` (commit this; NEVER commit `.env`)

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/mydb"
# Auth
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
# Add every new env var here (without its value) when you add one.
```

### `.editorconfig`

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

### `.nvmrc`

```
20
```

### `.vscode/settings.json`

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": { "source.fixAll.eslint": "explicit" },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

### `.vscode/extensions.json`

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "Prisma.prisma"
  ]
}
```

---

## 6. package.json scripts (standard set)

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "prisma generate && next build",
    "start": "next start",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "type-check": "tsc --noEmit",
    "validate": "pnpm type-check && pnpm lint && pnpm format:check",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "db:seed": "tsx prisma/seed.ts",
    "prepare": "husky"
  }
}
```

---

## 7. Team workflow (multi-developer)

### Husky + lint-staged

Install: `pnpm add -D husky lint-staged && pnpm exec husky init`

`.husky/pre-commit`:

```bash
pnpm exec lint-staged
```

`package.json`:

```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
    "*.{json,css,md}": ["prettier --write"]
  }
}
```

### Conventional commits — commitlint

Install: `pnpm add -D @commitlint/cli @commitlint/config-conventional`

`commitlint.config.mjs`:

```js
export default { extends: ["@commitlint/config-conventional"] }
```

`.husky/commit-msg`:

```bash
pnpm exec commitlint --edit $1
```

Commit format: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`.

### `.github/pull_request_template.md`

```markdown
## What & why

<!-- Short description + linked issue -->

## Changes

-

## Checklist

- [ ] `pnpm validate` passes (type-check + lint + format)
- [ ] Tested locally
- [ ] No secrets / .env committed
- [ ] Updated `.env.example` if new env vars added
```

### `.github/CODEOWNERS`

```
*                       @your-team
/src/features/auth/     @backend-lead
/prisma/                @backend-lead
```

---

## 8. How to add a new feature (AI: follow this checklist)

1. Create `src/features/<name>/` with `components/`, `server/`, `hooks/`, `schemas/`,
   `types.ts`, `index.ts`.
2. Define zod schemas in `schemas/`.
3. Put DB/business logic in `server/<name>.service.ts` and `server/<name>.queries.ts`
   (each starts with `import "server-only";`).
4. Export only the public surface from `index.ts`.
5. Add route(s) under `src/app/` that import from `@/features/<name>` and render.
6. Add API route(s) under `src/app/api/<name>/route.ts` wrapped in `withErrorHandler`.
7. Add `loading.tsx` + `error.tsx` to the route folder.
8. Never import another feature's internals — only its `index.ts`.

---

## 9. Hard DON'Ts

- ❌ DB queries or business logic inside `app/` pages, layouts, or components.
- ❌ Importing `@/features/x/server/...` from outside feature `x`.
- ❌ Committing `.env` (only `.env.example`).
- ❌ Server-only code without `import "server-only";`.
- ❌ Inconsistent API responses — always `ok()` / `fail()`.
- ❌ Catch-and-swallow errors — let `withErrorHandler` handle them.
- ❌ Putting one-off helpers in `src/lib` — keep them in the feature until reused.
