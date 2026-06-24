"use server"

import { db } from "@/server/db"
import { hasPermission } from "@/lib/permissions"
import { uploadFile, getObjectKey, getSignedUrl, deleteFile } from "@/lib/storage"
import { uploadDocumentSchema } from "@/features/documents/schemas/document.schema"
import { PERMISSIONS, ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from "@/lib/constants"
import { createAuditLog } from "@/lib/audit"
import type { DocumentCategory } from "@prisma/client"
import { requireSession, requirePermission, getAuditMeta } from "@/server/action-guard"
import { ok, fail, runAction, serialize, type ActionResult } from "@/server/action-result"

export async function getCompanyDocuments(category?: string): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.DOCUMENT_READ)

    const where: Record<string, unknown> = { isCompanyDoc: true }
    if (category) where.category = category

    const documents = await db.document.findMany({ where, orderBy: { createdAt: "desc" } })

    const uploaderIds = [...new Set(documents.map((d) => d.uploadedById))]
    const uploaders = await db.employee.findMany({
      where: { id: { in: uploaderIds } },
      select: { id: true, firstName: true, lastName: true },
    })
    const uploaderMap = new Map(uploaders.map((u) => [u.id, `${u.firstName} ${u.lastName}`]))

    const enriched = documents.map((doc) => ({
      ...doc,
      uploaderName: uploaderMap.get(doc.uploadedById) ?? "Unknown",
    }))

    return ok(serialize({ data: enriched }))
  })
}

export async function uploadDocument(formData: FormData): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.DOCUMENT_WRITE)

    const file = formData.get("file") as File | null
    if (!file) return fail("No file provided")
    if (file.size > MAX_FILE_SIZE)
      return fail(`File size exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`)
    if (!ALLOWED_FILE_TYPES.includes(file.type))
      return fail(`File type '${file.type}' is not allowed`)

    const rawMeta = {
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || undefined,
      category: (formData.get("category") as string) || "OTHER",
      employeeId: (formData.get("employeeId") as string) || undefined,
      expiresAt: (formData.get("expiresAt") as string) || undefined,
    }
    const metaResult = uploadDocumentSchema.safeParse(rawMeta)
    if (!metaResult.success) return fail("Invalid metadata", metaResult.error.flatten())
    const meta = metaResult.data

    const id = crypto.randomUUID()
    const objectKey = getObjectKey(`documents/${meta.employeeId || "company"}`, file.name, id)
    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadFile(objectKey, buffer, file.type, file.size)

    const isCompanyDoc = !meta.employeeId
    const document = await db.document.create({
      data: {
        id,
        title: meta.title,
        description: meta.description,
        category: meta.category as DocumentCategory,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        objectKey,
        employeeId: meta.employeeId ?? null,
        uploadedById: session.user.id,
        isCompanyDoc,
        expiresAt: meta.expiresAt ? new Date(meta.expiresAt) : null,
      },
    })

    const auditMeta = await getAuditMeta()
    await createAuditLog(session, {
      action: "document.upload",
      module: "document",
      entityType: "Document",
      entityId: document.id,
      changes: {
        title: document.title,
        category: document.category,
        fileName: document.fileName,
        fileSize: document.fileSize,
        employeeId: document.employeeId,
        isCompanyDoc: document.isCompanyDoc,
      },
      ...auditMeta,
    })

    return ok(serialize({ data: document }))
  })
}

export async function getDocumentUrl(
  id: string,
  opts?: { download?: boolean },
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()

    const document = await db.document.findUnique({ where: { id } })
    if (!document) return fail("Document not found")

    if (document.employeeId !== null) {
      const canRead = hasPermission(session, PERMISSIONS.DOCUMENT_READ)
      const isOwner = session.user.id === document.employeeId
      if (!canRead && !isOwner) return fail("Forbidden")
    } else if (!hasPermission(session, PERMISSIONS.DOCUMENT_READ)) {
      return fail("Forbidden")
    }

    const url = await getSignedUrl(
      document.objectKey,
      900,
      opts?.download ? { downloadFileName: document.fileName } : undefined,
    )
    return ok(serialize({ data: { url, document } }))
  })
}

export async function deleteDocument(
  id: string,
): Promise<ActionResult<{ data: { success: true } }>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.DOCUMENT_DELETE)

    const document = await db.document.findUnique({ where: { id } })
    if (!document) return fail("Document not found")

    await deleteFile(document.objectKey)
    await db.document.delete({ where: { id } })

    const auditMeta = await getAuditMeta()
    await createAuditLog(session, {
      action: "document.delete",
      module: "document",
      entityType: "Document",
      entityId: id,
      changes: {
        title: document.title,
        fileName: document.fileName,
        category: document.category,
        employeeId: document.employeeId,
      },
      ...auditMeta,
    })

    return ok({ data: { success: true } as const })
  })
}
