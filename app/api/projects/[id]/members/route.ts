import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withProjectAccess } from "@/features/projects/server/project-access"
import type { Session } from "next-auth"

// Both Account Managers + every team member, deduped - powers the @mention picker.
const PERSON = { id: true, firstName: true, lastName: true, profilePhoto: true } as const

export const GET = withProjectAccess(
  async (_req: NextRequest, ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const { id: projectId } = await ctx.params
      const project = await db.project.findUnique({
        where: { id: projectId },
        select: {
          owner: { select: PERSON },
          secondaryAccountManager: { select: PERSON },
          teams: {
            select: {
              members: {
                select: {
                  employee: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      profilePhoto: true,
                      designation: { select: { title: true } },
                    },
                  },
                },
              },
            },
          },
        },
      })
      if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

      const byId = new Map<string, unknown>()
      const leads = [project.owner, project.secondaryAccountManager]
      for (const lead of leads) if (lead) byId.set(lead.id, { ...lead, isManager: true })
      for (const team of project.teams) {
        for (const m of team.members) {
          if (!byId.has(m.employee.id)) byId.set(m.employee.id, m.employee)
        }
      }

      const members = [...byId.values()].sort((a, b) => {
        const an = `${(a as { firstName: string }).firstName}`
        const bn = `${(b as { firstName: string }).firstName}`
        return an.localeCompare(bn)
      })

      return NextResponse.json({ data: members })
    } catch (error) {
      console.error("[PROJECT_MEMBERS_GET]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
