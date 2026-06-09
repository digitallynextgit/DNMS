/**
 * Next.js App Router catch-all route handler for NextAuth v5.
 *
 * All NextAuth endpoints (/api/auth/session, /api/auth/signin, /api/auth/signout,
 * /api/auth/callback/*, /api/auth/csrf, /api/auth/providers …) are handled here.
 */
import { handlers } from "@/lib/auth-options"

export const { GET, POST } = handlers
