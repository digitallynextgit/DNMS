import "server-only"

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/server/api-handler"
import { resolveProjectId, canAccessProject } from "@/features/projects/server/project-access"
import { requireClientModule } from "@/server/client-guard"
import { ActionError } from "@/server/action-result"
import type { Session } from "next-auth"

// Who may drive the project mailer: staff with access to the project, or a portal client holding
// the "mailer" module on it. Both branches resolve the project id themselves and overwrite
// ctx.params.id, so nothing downstream trusts the id from the request.

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
        // Proves the account is active, the grant exists and it carries the mailer module.
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
