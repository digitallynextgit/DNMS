import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectAccess, canManageProject } from "@/features/projects/server/project-access"
import { updateRequirementStatus } from "@/features/projects/server/requirements.service"
import type { RequirementStatus } from "@prisma/client"
import type { Session } from "next-auth"

const STATUSES: RequirementStatus[] = ["OPEN", "IN_PROGRESS", "PROVIDED", "REJECTED", "CLOSED"]

// PATCH /api/projects/[id]/requirements/[requirementId]
//
// Who may move it:
//   • the person it is requested from - they are the one doing the providing,
//   • the raiser - they can close or cancel their own ask,
//   • a project admin / Account Manager.
// A rejection must say why, otherwise the raiser is left guessing.
export const PATCH = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId, requirementId } = ctx.params
      const requirement = await db.projectRequirement.findUnique({
        where: { id: requirementId },
        select: { id: true, projectId: true, raisedById: true, requestedFromId: true },
      })
      if (!requirement || requirement.projectId !== projectId) {
        return NextResponse.json({ error: "Requirement not found" }, { status: 404 })
      }

      const isOwner = requirement.requestedFromId === session.user.id
      const isRaiser = requirement.raisedById === session.user.id
      const isAdmin = await canManageProject(session, projectId)
      if (!isOwner && !isRaiser && !isAdmin) {
        return NextResponse.json(
          {
            error:
              "Only the person it was requested from, the raiser, or a project admin can update this",
          },
          { status: 403 },
        )
      }

      const body = await req.json()
      const status = body.status as RequirementStatus | undefined
      if (!status || !STATUSES.includes(status)) {
        return NextResponse.json({ error: "A valid status is required" }, { status: 422 })
      }

      const note =
        typeof body.resolutionNote === "string" && body.resolutionNote.trim()
          ? body.resolutionNote.trim()
          : null
      if (status === "REJECTED" && !note) {
        return NextResponse.json(
          { error: "A reason is required to reject a requirement." },
          { status: 422 },
        )
      }

      const updated = await updateRequirementStatus({
        requirementId,
        actorId: session.user.id,
        status,
        resolutionNote: note,
      })
      return NextResponse.json({ data: updated })
    } catch (error) {
      console.error("[PROJECT_REQUIREMENT_PATCH]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// DELETE - the raiser withdrawing something they should not have asked for, or an
// admin clearing a duplicate. Linked tasks are unblocked by the SET NULL FK.
export const DELETE = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId, requirementId } = ctx.params
      const requirement = await db.projectRequirement.findUnique({
        where: { id: requirementId },
        select: { id: true, projectId: true, raisedById: true },
      })
      if (!requirement || requirement.projectId !== projectId) {
        return NextResponse.json({ error: "Requirement not found" }, { status: 404 })
      }
      const isAdmin = await canManageProject(session, projectId)
      if (requirement.raisedById !== session.user.id && !isAdmin) {
        return NextResponse.json(
          { error: "Only the person who raised this, or a project admin, can delete it" },
          { status: 403 },
        )
      }
      await db.projectRequirement.delete({ where: { id: requirementId } })
      return NextResponse.json({ success: true })
    } catch (error) {
      console.error("[PROJECT_REQUIREMENT_DELETE]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
