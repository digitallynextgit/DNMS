import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"
import { db } from "@/server/db"
import { withProjectAccess } from "@/features/projects/server/project-access"
import { logActivity } from "@/features/projects/server/activity"
import { createNotifications } from "@/lib/notifications"
import { publishChat } from "@/server/chat-stream"
import { isB2Configured, uploadFile, getObjectKey } from "@/lib/storage"
import { resizeImage } from "@/lib/image-resize"
import { ATTACHMENT_SELECT } from "../replies/route"

export const runtime = "nodejs"

const MAX_BYTES = 25 * 1024 * 1024
const MAX_DIM = 1600

const AUTHOR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  profilePhoto: true,
  designation: { select: { title: true } },
}

function kindOf(contentType: string): "IMAGE" | "AUDIO" | "FILE" {
  if (contentType.startsWith("image/")) return "IMAGE"
  if (contentType.startsWith("audio/")) return "AUDIO"
  return "FILE"
}

/**
 * POST /api/projects/:id/messages/:messageId/attachments
 *
 * Creates a REPLY carrying the files, rather than attaching to a reply that
 * already exists. One request, so a picture can never end up in the thread
 * without a reply to hang from, and a failed upload leaves nothing behind.
 *
 * Body: multipart with `files`, an optional `body` caption, and `durationSec` /
 * `waveform` for a voice note.
 */
export const POST = withProjectAccess(
  async (req: NextRequest, ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const { id: projectId, messageId } = await ctx.params

      const parent = await db.projectMessage.findUnique({
        where: { id: messageId },
        select: { id: true, title: true, authorId: true, replies: { select: { authorId: true } } },
      })
      if (!parent) return NextResponse.json({ error: "Message not found" }, { status: 404 })

      if (!(await isB2Configured())) {
        return NextResponse.json({ error: "File storage is not configured." }, { status: 500 })
      }

      const form = await req.formData()
      const files = form.getAll("files").filter((f): f is File => f instanceof File)
      if (files.length === 0) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
      }

      const caption = String(form.get("body") ?? "")
        .trim()
        .slice(0, 4000)
      const durationSec = Number(form.get("durationSec")) || null
      // Clamped and capped: it arrives from the browser, so a hostile client
      // should not get to store an unbounded array.
      const waveform = String(form.get("waveform") ?? "")
        .split(",")
        .map((n) => Number(n.trim()))
        .filter((n) => Number.isFinite(n))
        .map((n) => Math.max(0, Math.min(100, Math.round(n))))
        .slice(0, 128)

      const prepared: {
        kind: "IMAGE" | "AUDIO" | "FILE"
        objectKey: string
        fileName: string
        contentType: string
        size: number
        width: number | null
        height: number | null
        waveform: number[]
        durationSec: number | null
      }[] = []

      for (const file of files) {
        if (file.size > MAX_BYTES) {
          return NextResponse.json({ error: `${file.name} is larger than 25 MB` }, { status: 413 })
        }
        const kind = kindOf(file.type)
        const original = Buffer.from(await file.arrayBuffer())

        // Only pictures are re-encoded. Audio must stay byte-for-byte or the
        // voice note stops playing, and an arbitrary file is not ours to rewrite.
        const out =
          kind === "IMAGE"
            ? await resizeImage(original, file.type, { maxDim: MAX_DIM, quality: 82 })
            : {
                bytes: original,
                contentType: file.type || "application/octet-stream",
                ext: "",
                width: null,
                height: null,
                resized: false,
              }

        const name = file.name || (kind === "AUDIO" ? "voice-note.webm" : "file")
        const objectKey = getObjectKey(`projects/${projectId}/messages`, name, crypto.randomUUID())
        await uploadFile(objectKey, out.bytes, out.contentType)

        prepared.push({
          kind,
          objectKey,
          fileName: name.slice(0, 200),
          contentType: out.contentType,
          size: out.bytes.length,
          width: out.width,
          height: out.height,
          waveform: kind === "AUDIO" ? waveform : [],
          durationSec: kind === "AUDIO" ? durationSec : null,
        })
      }

      const label =
        prepared[0]?.kind === "AUDIO"
          ? "Voice message"
          : prepared[0]?.kind === "IMAGE"
            ? "Photo"
            : "File"

      const reply = await db.projectMessageReply.create({
        data: {
          messageId,
          authorId: session.user.id,
          // The caption IS the reply text; with no caption the thread still needs
          // something readable where the words would be.
          content: caption || label,
          mentionedIds: [],
          attachments: { create: prepared },
        },
        include: { author: { select: AUTHOR_SELECT }, attachments: ATTACHMENT_SELECT },
      })

      await logActivity({
        projectId,
        actorId: session.user.id,
        type: "MESSAGE_POSTED",
        entityType: "MESSAGE",
        entityId: messageId,
        meta: { title: parent.title, reply: true, attachments: prepared.length },
      })

      const watchers = new Set<string>([parent.authorId])
      for (const r of parent.replies) watchers.add(r.authorId)
      watchers.delete(session.user.id)

      if (watchers.size > 0) {
        const who = `${reply.author.firstName} ${reply.author.lastName}`
        await createNotifications(
          [...watchers].map((employeeId) => ({
            employeeId,
            title: "New reply",
            message: `${who} sent ${label.toLowerCase()} in "${parent.title}".`,
            type: "info",
            link: `/projects/${projectId}?tab=messages`,
          })),
          { force: true },
        )
      }

      await Promise.all(
        [...watchers].map((employeeId) =>
          publishChat({
            type: "project-message",
            conversationId: messageId,
            projectId,
            recipientId: employeeId,
          }),
        ),
      )

      return NextResponse.json({ data: reply }, { status: 201 })
    } catch (error) {
      console.error("[PROJECT_MESSAGE_ATTACHMENTS_POST]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
