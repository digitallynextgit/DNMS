"use server"

import { db } from "@/lib/db"
import { hasPermission } from "@/lib/permissions"
import { isB2Configured, uploadFile, getObjectKey, getSignedUrl, deleteFile } from "@/lib/b2"
import { PERMISSIONS, ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from "@/lib/constants"
import { createAuditLog } from "@/lib/audit"
import type { DocumentCategory } from "@prisma/client"
import { requireSession, getAuditMeta } from "./_guard"
import { ok, fail, runAction, serialize, type ActionResult } from "./_result"

export async function getEmployeeDocuments(employeeId: string): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    const canRead = hasPermission(session, PERMISSIONS.DOCUMENT_READ)
    if (!canRead && session.user.id !== employeeId) return fail("Forbidden")

    const documents = await db.employeeDocument.findMany({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
    })
    return ok(serialize({ data: documents }))
  })
}

export async function uploadEmployeeDocument(
  employeeId: string,
  formData: FormData,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    const canWrite = hasPermission(session, PERMISSIONS.DOCUMENT_WRITE)
    if (!canWrite && session.user.id !== employeeId) return fail("Forbidden")

    if (!isB2Configured())
      return fail("Backblaze B2 storage is not configured. Set the B2_* env vars.")

    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    })
    if (!employee) return fail("Employee not found")

    const file = formData.get("file") as File | null
    if (!file) return fail("No file provided")
    if (file.size > MAX_FILE_SIZE)
      return fail(`File size exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`)
    if (!ALLOWED_FILE_TYPES.includes(file.type))
      return fail(`File type '${file.type}' is not allowed`)

    const title = (formData.get("title") as string)?.trim()
    if (!title) return fail("Title is required")

    const category = ((formData.get("category") as string) ?? "OTHER") as DocumentCategory
    const expiresAtRaw = formData.get("expiresAt") as string | null

    const docId = crypto.randomUUID()
    const objectKey = getObjectKey(`employee-documents/${employeeId}`, file.name, docId)
    const buffer = Buffer.from(await file.arrayBuffer())
    await uploadFile(objectKey, buffer, file.type)

    const document = await db.employeeDocument.create({
      data: {
        id: docId,
        employeeId,
        title,
        category,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        objectKey,
        uploadedById: session.user.id,
        expiresAt: expiresAtRaw ? new Date(expiresAtRaw) : null,
      },
    })

    const meta = await getAuditMeta()
    await createAuditLog(session, {
      action: "employee_document.upload",
      module: "document",
      entityType: "EmployeeDocument",
      entityId: document.id,
      changes: { employeeId, title, category, fileName: file.name, fileSize: file.size },
      ...meta,
    })

    return ok(serialize({ data: document }))
  })
}

export async function getEmployeeDocumentUrl(
  employeeId: string,
  docId: string,
): Promise<ActionResult<unknown>> {
  return runAction(async () => {
    const session = await requireSession()
    const canRead = hasPermission(session, PERMISSIONS.DOCUMENT_READ)
    if (!canRead && session.user.id !== employeeId) return fail("Forbidden")

    const document = await db.employeeDocument.findFirst({ where: { id: docId, employeeId } })
    if (!document) return fail("Document not found")

    // Files are private in B2; hand back a short-lived presigned URL.
    const url = await getSignedUrl(document.objectKey)
    return ok(serialize({ data: { ...document, url } }))
  })
}

export async function deleteEmployeeDocument(
  employeeId: string,
  docId: string,
): Promise<ActionResult<{ data: { id: string } }>> {
  return runAction(async () => {
    const session = await requireSession()
    if (!hasPermission(session, PERMISSIONS.DOCUMENT_DELETE)) return fail("Forbidden")

    const document = await db.employeeDocument.findFirst({ where: { id: docId, employeeId } })
    if (!document) return fail("Document not found")

    // Best-effort storage delete; never block the DB cleanup if it fails.
    if (isB2Configured()) {
      await deleteFile(document.objectKey).catch((err) =>
        console.error("[employee-document] B2 delete failed:", err),
      )
    }
    await db.employeeDocument.delete({ where: { id: docId } })

    const meta = await getAuditMeta()
    await createAuditLog(session, {
      action: "employee_document.delete",
      module: "document",
      entityType: "EmployeeDocument",
      entityId: docId,
      changes: { employeeId, title: document.title, fileName: document.fileName },
      ...meta,
    })
    return ok({ data: { id: docId } })
  })
}
