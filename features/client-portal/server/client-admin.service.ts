// =============================================================================
// Project → Clients (staff side)
// =============================================================================
// Everything here is scoped to ONE project. The projectId is supplied by the
// route guard (withProjectManager), which has already proved the caller may
// manage that project and resolved a slug to a real id - it is never taken from
// a request body, so this surface cannot be used to grant access elsewhere.
//
// A ClientUser is global (one row per email) but their VISIBILITY is per
// project: the modules live on the ClientProjectAccess row. The same person can
// be on two projects with different sections on each.
// =============================================================================

import "server-only"

import bcrypt from "bcryptjs"
import { randomBytes } from "node:crypto"
import { db } from "@/server/db"
import { provisionIdentity, setPassword } from "@/server/identity"
import { createAuditLog } from "@/lib/audit"
import { addEmailJob } from "@/lib/queue"
import { getConfig } from "@/server/app-config"
import { ok, fail, runAction, serialize, type ActionResult } from "@/server/action-result"
import { resolveModules } from "../modules"
import {
  projectClientCreateSchema,
  projectClientUpdateSchema,
  projectClientResetSchema,
  type ProjectClientCreateInput,
  type ProjectClientUpdateInput,
  type ProjectClientResetInput,
} from "../schemas/client-portal.schema"
import { renderClientInviteEmail } from "../emails/client-invite"
import type { Session } from "next-auth"

const ACCESS_SELECT = {
  id: true,
  modules: true,
  status: true,
  createdAt: true,
  clientUser: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: true,
    },
  },
} as const

/**
 * A temporary password, emailed to the client. 18 base64url chars ≈ 108 bits -
 * not guessable, and never returned to the caller, so it cannot surface in an
 * API response, a log line or the browser devtools.
 */
export function generatePassword(): string {
  return randomBytes(14).toString("base64url").slice(0, 18)
}

export async function sendCredentials(input: {
  to: string
  name: string
  password: string
  projectName: string
  isReset: boolean
  mustChange: boolean
}): Promise<void> {
  const appUrl = (await getConfig("APP_URL")) ?? process.env.NEXTAUTH_URL ?? ""
  const email = renderClientInviteEmail({
    name: input.name,
    email: input.to,
    tempPassword: input.password,
    isReset: input.isReset,
    mustChange: input.mustChange,
    projectName: input.projectName,
    loginUrl: appUrl ? `${appUrl.replace(/\/$/, "")}/login` : "/login",
  })
  addEmailJob({
    to: input.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    profile: "notifications",
  })
}

// ─── Read ───────────────────────────────────────────────────────────────────

/**
 * Everyone with access to THIS project - plus, when the project belongs to a
 * client, that client and the people at it who do NOT have this project yet.
 * The tab offers those as a pick-list, so giving a second project to someone
 * who already has a login is one click rather than a re-typed invitation.
 */
export async function listProjectClients(projectId: string): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const [rows, project] = await Promise.all([
      db.clientProjectAccess.findMany({
        where: { projectId },
        select: ACCESS_SELECT,
        orderBy: { createdAt: "desc" },
      }),
      db.project.findUnique({
        where: { id: projectId },
        select: { client: { select: { id: true, name: true, slug: true } } },
      }),
    ])
    const client = project?.client ?? null
    const onProject = new Set(rows.map((r) => r.clientUser.id))
    const candidates = client
      ? (
          await db.clientUser.findMany({
            where: { clientId: client.id, isActive: true },
            select: { id: true, name: true, email: true },
            orderBy: { name: "asc" },
          })
        ).filter((c) => !onProject.has(c.id))
      : []
    // Report only modules this build understands, so a key left over from
    // another deploy never renders as something it won't actually unlock.
    return ok(
      serialize({
        data: rows.map((r) => ({ ...r, modules: resolveModules(r.modules) })),
        client,
        candidates,
      }),
    )
  })
}

// ─── Create / attach ────────────────────────────────────────────────────────

/**
 * Add a person to this project's portal.
 *
 * Two shapes of request. `contactId` names someone already on the books at this
 * project's client: they get the project, and nothing else changes. Otherwise a
 * name and email arrive, and if the email already belongs to a client account
 * they are ATTACHED rather than rejected - the same person legitimately works
 * across several of our projects and should keep one login. Only a brand-new
 * account has a password generated and emailed.
 */
export async function addProjectClient(
  projectId: string,
  body: ProjectClientCreateInput,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = projectClientCreateSchema.parse(body)

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, clientId: true },
    })
    if (!project) return fail("Project not found", undefined, 404)

    let clientUserId: string
    let issuedPassword: string | null = null
    let mustChange = true
    let email: string
    let name: string

    if ("contactId" in input) {
      // Only THIS client's people are offered, so a contact id from another
      // company cannot be pasted in to reach this project.
      const contact = await db.clientUser.findFirst({
        where: { id: input.contactId, ...(project.clientId ? { clientId: project.clientId } : {}) },
        select: { id: true, name: true, email: true },
      })
      if (!contact) return fail("That contact is not at this project's client", undefined, 404)
      clientUserId = contact.id
      email = contact.email
      name = contact.name
    } else {
      email = input.email
      name = input.name
      mustChange = input.forcePasswordChange

      // An email that belongs to an EMPLOYEE is refused outright: one address
      // with both a staff and a client account means whichever login page they
      // happen to use decides what they can see.
      const staff = await db.employee.findUnique({ where: { email }, select: { id: true } })
      if (staff) return fail("This email belongs to an employee account", undefined, 409)

      const existing = await db.clientUser.findUnique({
        where: { email },
        select: { id: true, clientId: true },
      })

      if (existing) {
        clientUserId = existing.id
        // A login that predates clients, or was made from a project with none,
        // adopts this project's client. One that already belongs to a different
        // company is left alone: that is a question for a person, not a side
        // effect of granting a project.
        if (project.clientId && !existing.clientId) {
          await db.clientUser.update({
            where: { id: existing.id },
            data: { clientId: project.clientId },
          })
        }
      } else {
        issuedPassword = generatePassword()
        const passwordHash = await bcrypt.hash(issuedPassword, 12)
        const created = await db.clientUser.create({
          data: {
            name,
            email,
            phone: input.phone || null,
            clientId: project.clientId,
            passwordHash,
            mustChangePassword: mustChange,
            createdById: session.user.id,
          },
          select: { id: true, tenantId: true },
        })
        clientUserId = created.id

        // Give the new portal account a platform identity (M2). If this address
        // already belongs to somebody - a staff member being given client access -
        // provisionIdentity keeps their existing credential and just adds the
        // CLIENT membership, so they keep using the password they already have.
        await provisionIdentity({
          email,
          name,
          tenantId: created.tenantId,
          kind: "CLIENT",
          clientUserId: created.id,
          passwordHash,
          mustChangePassword: mustChange,
        })
      }
    }

    const already = await db.clientProjectAccess.findUnique({
      where: { clientUserId_projectId: { clientUserId, projectId } },
      select: { id: true },
    })
    if (already) return fail("This person already has access to this project", undefined, 409)

    const access = await db.clientProjectAccess.create({
      data: {
        clientUserId,
        projectId,
        modules: input.modules,
        status: "ACTIVE",
        grantedById: session.user.id,
      },
      select: ACCESS_SELECT,
    })

    if (issuedPassword) {
      await sendCredentials({
        to: email,
        name,
        password: issuedPassword,
        projectName: project.name,
        isReset: false,
        mustChange,
      })
    }

    await createAuditLog(session, {
      action: "client:add_to_project",
      module: "project",
      entityType: "ClientProjectAccess",
      entityId: access.id,
      changes: { projectId, email, modules: input.modules, reused: !issuedPassword },
    })

    return ok(
      serialize({
        data: { ...access, modules: resolveModules(access.modules) },
        // Lets the UI say "existing login attached" instead of implying an
        // invite email went out when it didn't.
        credentialsSent: !!issuedPassword,
      }),
    )
  })
}

// ─── Update ─────────────────────────────────────────────────────────────────

/** Change a client's sections on this project, pause them, or fix their name. */
export async function updateProjectClient(
  projectId: string,
  accessId: string,
  body: ProjectClientUpdateInput,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = projectClientUpdateSchema.parse(body)

    // accessId AND projectId in the WHERE: without the projectId, an id from
    // another project would resolve and be editable from this project's screen.
    const existing = await db.clientProjectAccess.findFirst({
      where: { id: accessId, projectId },
      select: { id: true, clientUserId: true },
    })
    if (!existing) return fail("Client access not found", undefined, 404)

    if (input.name !== undefined || input.phone !== undefined || input.isActive !== undefined) {
      await db.clientUser.update({
        where: { id: existing.clientUserId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      })
    }

    const access = await db.clientProjectAccess.update({
      where: { id: accessId },
      data: {
        ...(input.modules !== undefined ? { modules: input.modules } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      select: ACCESS_SELECT,
    })

    await createAuditLog(session, {
      action: "client:update_access",
      module: "project",
      entityType: "ClientProjectAccess",
      entityId: accessId,
      changes: input,
    })

    return ok(serialize({ data: { ...access, modules: resolveModules(access.modules) } }))
  })
}

// ─── Password ───────────────────────────────────────────────────────────────

/** Issue a fresh password and email it. */
export async function resetProjectClientPassword(
  projectId: string,
  accessId: string,
  body: ProjectClientResetInput,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = projectClientResetSchema.parse(body ?? {})

    const access = await db.clientProjectAccess.findFirst({
      where: { id: accessId, projectId },
      select: {
        clientUser: { select: { id: true, name: true, email: true } },
        project: { select: { name: true } },
      },
    })
    if (!access) return fail("Client access not found", undefined, 404)

    const password = generatePassword()
    await setPassword({ clientUserId: access.clientUser.id }, password, {
      mustChangePassword: input.forcePasswordChange,
    })

    await sendCredentials({
      to: access.clientUser.email,
      name: access.clientUser.name,
      password,
      projectName: access.project.name,
      isReset: true,
      mustChange: input.forcePasswordChange,
    })

    await createAuditLog(session, {
      action: "client:password_reset",
      module: "project",
      entityType: "ClientUser",
      entityId: access.clientUser.id,
    })

    return ok(serialize({ data: { id: accessId } }))
  })
}

// ─── Remove ─────────────────────────────────────────────────────────────────

/**
 * Take this project away from a client. Their login survives - they may still
 * hold other projects - but this one vanishes from their portal on their next
 * request, since access is read live rather than from their token.
 */
export async function removeProjectClient(
  projectId: string,
  accessId: string,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const existing = await db.clientProjectAccess.findFirst({
      where: { id: accessId, projectId },
      select: { id: true, clientUserId: true },
    })
    if (!existing) return fail("Client access not found", undefined, 404)

    await db.clientProjectAccess.delete({ where: { id: accessId } })

    await createAuditLog(session, {
      action: "client:remove_from_project",
      module: "project",
      entityType: "ClientProjectAccess",
      entityId: accessId,
      changes: { projectId, clientUserId: existing.clientUserId },
    })

    return ok(serialize({ data: { id: accessId } }))
  })
}
