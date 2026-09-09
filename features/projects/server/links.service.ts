import "server-only"

import type { Prisma } from "@prisma/client"
import type { Session } from "next-auth"

import { db } from "@/server/db"
import { ForbiddenError, NotFoundError } from "@/lib/errors"
import type { DocTag } from "../lib/doc-tag"
import { canManageProject } from "./project-access"
import { getFolder } from "./folders.service"

export const LINK_SELECT = {
  id: true,
  projectId: true,
  folderId: true,
  title: true,
  url: true,
  tag: true,
  description: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
} satisfies Prisma.ProjectLinkSelect

export type LinkRow = Prisma.ProjectLinkGetPayload<{ select: typeof LINK_SELECT }>

export interface LinkInput {
  title: string
  url: string
  folderId: string | null
  tag: DocTag | null
  description: string | null
}

export async function listProjectLinks(projectId: string): Promise<LinkRow[]> {
  return db.projectLink.findMany({
    where: { projectId },
    select: LINK_SELECT,
    orderBy: { createdAt: "desc" },
  })
}

async function getLink(projectId: string, linkId: string): Promise<LinkRow> {
  const link = await db.projectLink.findFirst({
    where: { id: linkId, projectId },
    select: LINK_SELECT,
  })
  if (!link) throw new NotFoundError("Link")
  return link
}

async function assertCanEdit(session: Session, projectId: string, link: { createdById: string }) {
  if (link.createdById === session.user.id) return
  if (await canManageProject(session, projectId)) return
  throw new ForbiddenError("Only whoever added the link or a project manager can change it")
}

export async function createLink(
  session: Session,
  projectId: string,
  input: LinkInput,
): Promise<LinkRow> {
  if (input.folderId) await getFolder(projectId, input.folderId)
  return db.projectLink.create({
    data: {
      projectId,
      folderId: input.folderId,
      title: input.title.trim(),
      url: input.url.trim(),
      tag: input.tag,
      description: input.description?.trim() || null,
      createdById: session.user.id,
    },
    select: LINK_SELECT,
  })
}

export async function updateLink(
  session: Session,
  projectId: string,
  linkId: string,
  patch: Partial<LinkInput>,
): Promise<LinkRow> {
  const link = await getLink(projectId, linkId)
  await assertCanEdit(session, projectId, link)
  if (patch.folderId) await getFolder(projectId, patch.folderId)
  return db.projectLink.update({
    where: { id: link.id },
    data: {
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.url !== undefined ? { url: patch.url.trim() } : {}),
      ...(patch.folderId !== undefined ? { folderId: patch.folderId } : {}),
      ...(patch.tag !== undefined ? { tag: patch.tag } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description?.trim() || null }
        : {}),
    },
    select: LINK_SELECT,
  })
}

export async function deleteLink(session: Session, projectId: string, linkId: string) {
  const link = await getLink(projectId, linkId)
  await assertCanEdit(session, projectId, link)
  await db.projectLink.delete({ where: { id: link.id } })
  return link
}
