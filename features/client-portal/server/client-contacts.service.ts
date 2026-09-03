import "server-only"

import bcrypt from "bcryptjs"
import type { Session } from "next-auth"
import { db } from "@/server/db"
import { provisionIdentity, setPassword } from "@/server/identity"
import { createAuditLog } from "@/lib/audit"
import { ok, fail, runAction, serialize, type ActionResult } from "@/server/action-result"
import { resolveModules } from "../modules"
import {
  clientContactCreateSchema,
  clientContactUpdateSchema,
  clientContactResetSchema,
  clientGrantCreateSchema,
  clientGrantUpdateSchema,
} from "../schemas/client-portal.schema"
import { generatePassword, sendCredentials } from "./client-admin.service"

// =============================================================================
// Client → Contacts (staff side)
// =============================================================================
// The same accounts and grants as Project → Portal access, reached from the
// other end. Here the CLIENT is fixed by the route guard (withClient) and a
// grant names a project and a person. Everything checks that the person, and
// the project, belong to that client, so this surface cannot be used to reach
// another company's projects or people.
//
// A ClientUser is global - one row per email. Attaching one to a client is a
// claim on that row, so a login that already belongs to ANOTHER client is
// refused rather than moved. Moving a person between companies is a decision
// for a person, not a side effect of a form.
// =============================================================================

const CONTACT_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  isActive: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  access: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      modules: true,
      status: true,
      createdAt: true,
      project: { select: { id: true, name: true, code: true, slug: true } },
    },
  },
} as const

const GRANT_SELECT = {
  id: true,
  modules: true,
  status: true,
  createdAt: true,
  clientUserId: true,
  project: { select: { id: true, name: true, code: true, slug: true } },
} as const

/** Report only modules this build understands - same rule as the project tab. */
function withModules<T extends { access: { modules: string[] }[] }>(contact: T) {
  return {
    ...contact,
    access: contact.access.map((a) => ({ ...a, modules: resolveModules(a.modules) })),
  }
}

/** A project must belong to THIS client before one of its people can be granted it. */
function projectOfClient(clientId: string, projectId: string) {
  return db.project.findFirst({
    where: { id: projectId, clientId },
    select: { id: true, name: true },
  })
}

function contactOfClient(clientId: string, contactId: string) {
  return db.clientUser.findFirst({
    where: { id: contactId, clientId },
    select: { id: true, name: true, email: true },
  })
}

// ─── Contacts ───────────────────────────────────────────────────────────────

/**
 * Give one of the client's people a portal login, optionally with a first
 * project already granted. A brand-new account gets a generated password by
 * email; an existing login is attached to the client and keeps its password.
 */
export async function createClientContact(
  clientId: string,
  body: unknown,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = clientContactCreateSchema.parse(body)

    const client = await db.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true },
    })
    if (!client) return fail("Client not found", undefined, 404)

    // One address with both a staff and a client account means whichever login
    // page they happen to use decides what they can see. Refused outright.
    const staff = await db.employee.findUnique({
      where: { email: input.email },
      select: { id: true },
    })
    if (staff) return fail("This email belongs to an employee account", undefined, 409)

    const grant = input.grant ?? null
    const grantProject = grant ? await projectOfClient(clientId, grant.projectId) : null
    if (grant && !grantProject) {
      return fail("That project does not belong to this client", undefined, 422)
    }

    const existing = await db.clientUser.findUnique({
      where: { email: input.email },
      select: { id: true, clientId: true },
    })

    let contactId: string
    let issuedPassword: string | null = null

    if (existing) {
      if (existing.clientId && existing.clientId !== clientId) {
        return fail("This email already has a login at another client", undefined, 409)
      }
      contactId = existing.id
      if (!existing.clientId) {
        await db.clientUser.update({ where: { id: existing.id }, data: { clientId } })
      }
    } else {
      issuedPassword = generatePassword()
      const passwordHash = await bcrypt.hash(issuedPassword, 12)
      const created = await db.clientUser.create({
        data: {
          name: input.name,
          email: input.email,
          phone: input.phone || null,
          clientId,
          passwordHash,
          mustChangePassword: input.forcePasswordChange,
          createdById: session.user.id,
        },
        select: { id: true, tenantId: true },
      })
      contactId = created.id

      // Platform identity (M2). If the address already belongs to somebody,
      // provisionIdentity keeps their credential and only adds the CLIENT
      // membership, so they keep the password they already have.
      await provisionIdentity({
        email: input.email,
        name: input.name,
        tenantId: created.tenantId,
        kind: "CLIENT",
        clientUserId: created.id,
        passwordHash,
        mustChangePassword: input.forcePasswordChange,
      })
    }

    if (grant && grantProject) {
      const already = await db.clientProjectAccess.findUnique({
        where: { clientUserId_projectId: { clientUserId: contactId, projectId: grantProject.id } },
        select: { id: true },
      })
      if (!already) {
        await db.clientProjectAccess.create({
          data: {
            clientUserId: contactId,
            projectId: grantProject.id,
            modules: grant.modules,
            status: "ACTIVE",
            grantedById: session.user.id,
          },
        })
      }
    }

    if (issuedPassword) {
      await sendCredentials({
        to: input.email,
        name: input.name,
        password: issuedPassword,
        // The invite names what they are being given access to. Without a
        // first project that is the company itself.
        projectName: grantProject?.name ?? client.name,
        isReset: false,
        mustChange: input.forcePasswordChange,
      })
    }

    await createAuditLog(session, {
      action: "client:add_contact",
      module: "client",
      entityType: "ClientUser",
      entityId: contactId,
      changes: { clientId, email: input.email, reused: !!existing, grant },
    })

    const contact = await db.clientUser.findUnique({
      where: { id: contactId },
      select: CONTACT_SELECT,
    })
    return ok(
      serialize({
        data: contact ? withModules(contact) : null,
        // Lets the UI say "existing login attached" rather than implying an
        // invite went out when it did not.
        credentialsSent: !!issuedPassword,
      }),
    )
  })
}

/** Fix a contact's name or phone, or switch their login on and off. */
export async function updateClientContact(
  clientId: string,
  contactId: string,
  body: unknown,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = clientContactUpdateSchema.parse(body)
    const existing = await contactOfClient(clientId, contactId)
    if (!existing) return fail("Contact not found", undefined, 404)

    const contact = await db.clientUser.update({
      where: { id: contactId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      select: CONTACT_SELECT,
    })

    await createAuditLog(session, {
      action: "client:update_contact",
      module: "client",
      entityType: "ClientUser",
      entityId: contactId,
      changes: { clientId, ...input },
    })

    return ok(serialize({ data: withModules(contact) }))
  })
}

/** Issue a fresh password and email it. The old one stops working at once. */
export async function resetClientContactPassword(
  clientId: string,
  contactId: string,
  body: unknown,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = clientContactResetSchema.parse(body ?? {})
    const [contact, client] = await Promise.all([
      contactOfClient(clientId, contactId),
      db.client.findUnique({ where: { id: clientId }, select: { name: true } }),
    ])
    if (!contact || !client) return fail("Contact not found", undefined, 404)

    const password = generatePassword()
    await setPassword({ clientUserId: contact.id }, password, {
      mustChangePassword: input.forcePasswordChange,
    })
    await sendCredentials({
      to: contact.email,
      name: contact.name,
      password,
      projectName: client.name,
      isReset: true,
      mustChange: input.forcePasswordChange,
    })

    await createAuditLog(session, {
      action: "client:password_reset",
      module: "client",
      entityType: "ClientUser",
      entityId: contact.id,
      changes: { clientId },
    })

    return ok(serialize({ data: { id: contactId } }))
  })
}

// ─── Grants ─────────────────────────────────────────────────────────────────

/** Give one of the client's people one of the client's projects. */
export async function grantClientProject(
  clientId: string,
  body: unknown,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = clientGrantCreateSchema.parse(body)
    const [contact, project] = await Promise.all([
      contactOfClient(clientId, input.contactId),
      projectOfClient(clientId, input.projectId),
    ])
    if (!contact) return fail("Contact not found", undefined, 404)
    if (!project) return fail("That project does not belong to this client", undefined, 422)

    const already = await db.clientProjectAccess.findUnique({
      where: { clientUserId_projectId: { clientUserId: contact.id, projectId: project.id } },
      select: { id: true },
    })
    if (already) return fail("They already have access to this project", undefined, 409)

    const access = await db.clientProjectAccess.create({
      data: {
        clientUserId: contact.id,
        projectId: project.id,
        modules: input.modules,
        status: "ACTIVE",
        grantedById: session.user.id,
      },
      select: GRANT_SELECT,
    })

    await createAuditLog(session, {
      action: "client:add_to_project",
      module: "client",
      entityType: "ClientProjectAccess",
      entityId: access.id,
      changes: { clientId, projectId: project.id, email: contact.email, modules: input.modules },
    })

    return ok(serialize({ data: { ...access, modules: resolveModules(access.modules) } }))
  })
}

/** Change what a grant unlocks, or pause it. */
export async function updateClientGrant(
  clientId: string,
  grantId: string,
  body: unknown,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const input = clientGrantUpdateSchema.parse(body)
    // The grant must belong to one of THIS client's people; a grant id from
    // another company must not resolve here.
    const existing = await db.clientProjectAccess.findFirst({
      where: { id: grantId, clientUser: { clientId } },
      select: { id: true },
    })
    if (!existing) return fail("Access not found", undefined, 404)

    const access = await db.clientProjectAccess.update({
      where: { id: grantId },
      data: {
        ...(input.modules !== undefined ? { modules: input.modules } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
      select: GRANT_SELECT,
    })

    await createAuditLog(session, {
      action: "client:update_access",
      module: "client",
      entityType: "ClientProjectAccess",
      entityId: grantId,
      changes: { clientId, ...input },
    })

    return ok(serialize({ data: { ...access, modules: resolveModules(access.modules) } }))
  })
}

/** Take a project away from a contact. Their login, and other grants, survive. */
export async function revokeClientGrant(
  clientId: string,
  grantId: string,
  session: Session,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const existing = await db.clientProjectAccess.findFirst({
      where: { id: grantId, clientUser: { clientId } },
      select: { id: true, projectId: true, clientUserId: true },
    })
    if (!existing) return fail("Access not found", undefined, 404)

    await db.clientProjectAccess.delete({ where: { id: grantId } })

    await createAuditLog(session, {
      action: "client:remove_from_project",
      module: "client",
      entityType: "ClientProjectAccess",
      entityId: grantId,
      changes: { clientId, projectId: existing.projectId, clientUserId: existing.clientUserId },
    })

    return ok(serialize({ data: { id: grantId } }))
  })
}
