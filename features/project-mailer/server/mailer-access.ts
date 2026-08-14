import "server-only"

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/server/api-handler"
import { resolveProjectId, canAccessProject } from "@/features/projects/server/project-access"
import { requireClientModule } from "@/server/client-guard"
import { ActionError } from "@/server/action-result"
import type { Session } from "next-auth"

// =============================================================================
// Who may drive the project mailer?
//   • any staff member with access to the project - its owner, anyone with
//     project:read/write, or a member of any team on it, OR
//   • a client-portal account holding the "mailer" module ON THIS PROJECT.
//
// Team members, not just managers: the people who write the campaigns are the
// ones on the project, and a tab that renders for them but 403s on every call is
// worse than one that is hidden. Note this means any project member can send
// mail from the project's account and edit its SMTP settings - the same trust
// boundary the Passwords tab already draws around a project's team.
//
// Deliberately ONE guard rather than a parallel /api/portal/*/mailer tree. The
// mailer is a dozen endpoints; duplicating them would mean every future fix has
// two homes and the client copy is the one that silently rots. A single
// authorisation point is also the only version anyone can actually review.
//
// The rule that keeps it safe: nothing downstream ever reads a project id from
// the request. Both branches RESOLVE the id themselves and overwrite
// ctx.params.id with the real one, so a client passing another project's slug
// fails the grant lookup rather than reaching that project's data.
// =============================================================================

type MailerHandler = (
  req: NextRequest,
  ctx: { params: Record<string, string> },
  session: Session,
) => Promise<Response> | Response

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NextRouteContext = { params: Promise<any> | any }

async function resolveParams(context: NextRouteContext): Promise<Record<string, string>> {
  const raw = context?.params
  return raw && typeof (raw as Promise<unknown>).then === "function" ? await raw : (raw ?? {})
}

export function withMailerAccess(handler: MailerHandler) {
  return async (req: NextRequest, context: NextRouteContext) => {
    try {
      const session = await getSession()
      if (!session) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
      }
      const params = await resolveParams(context)

      if (session.user.kind === "client") {
        // Proves three things at once: the account is active, the grant on this
        // project exists, and it carries the mailer module. Throws otherwise.
        const { grant } = await requireClientModule(params.id ?? "", "mailer")
        params.id = grant.projectId
        return await handler(req, { params }, session)
      }

      const projectId = await resolveProjectId(params.id ?? "")
      if (!projectId) return NextResponse.json({ error: "Project not found" }, { status: 404 })
      params.id = projectId
      if (!(await canAccessProject(session, projectId))) {
        return NextResponse.json(
          { error: "You don't have access to this project" },
          { status: 403 },
        )
      }
      return await handler(req, { params }, session)
    } catch (err) {
      if (err instanceof ActionError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      console.error("[MAILER_ACCESS]", err)
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
    }
  }
}
