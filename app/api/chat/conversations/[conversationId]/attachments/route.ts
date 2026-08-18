import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { isB2Configured, uploadFile, getObjectKey } from "@/lib/storage"
import { resizeImage } from "@/lib/image-resize"
import { publishChat } from "@/server/chat-stream"

export const runtime = "nodejs"

const MAX_BYTES = 25 * 1024 * 1024
/** Chat pictures are viewed in a bubble, occasionally full screen. */
const MAX_DIM = 1600

function kindOf(contentType: string): "IMAGE" | "AUDIO" | "FILE" {
  if (contentType.startsWith("image/")) return "IMAGE"
  if (contentType.startsWith("audio/")) return "AUDIO"
  return "FILE"
}

/**
 * POST /api/chat/conversations/:id/attachments
 *
 * One request creates the message AND its files, so a picture can never exist
 * without a message to hang from - and a failed upload leaves nothing behind.
 *
 * Body: multipart with `files` (one or more) and an optional `body` caption.
 * Voice notes arrive here too, as an audio file plus `durationSec`.
 */
export const POST = withSession(async (req: NextRequest, ctx, session) => {
  const conversationId = ctx.params.conversationId
  const me = session.user.id

  // Membership proven from the database, never from the id in the URL.
  const member = await db.conversationParticipant.findUnique({
    where: { conversationId_employeeId: { conversationId, employeeId: me } },
    select: { conversationId: true },
  })
  if (!member) return NextResponse.json({ error: "Conversation not found" }, { status: 404 })

  if (!(await isB2Configured())) {
    return NextResponse.json({ error: "File storage is not configured." }, { status: 500 })
  }

  const form = await req.formData()
  const files = form.getAll("files").filter((f): f is File => f instanceof File)
  if (files.length === 0) return NextResponse.json({ error: "No file uploaded" }, { status: 400 })

  const caption = String(form.get("body") ?? "")
    .trim()
    .slice(0, 4000)
  const durationSec = Number(form.get("durationSec")) || null

  /**
   * Amplitude peaks the recorder sampled as the clip was spoken, sent as a
   * comma-separated list. Clamped and capped here because it arrives from the
   * browser - a hostile client should not get to store an unbounded array.
   */
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

    // Only pictures are re-encoded. Audio must stay byte-for-byte or the voice
    // note stops playing, and an arbitrary file is not ours to rewrite.
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
    const objectKey = getObjectKey(`chat/${conversationId}`, name, crypto.randomUUID())
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

  const message = await db.chatMessage.create({
    data: {
      conversationId,
      senderId: me,
      body: caption,
      attachments: { create: prepared },
    },
    select: {
      id: true,
      body: true,
      senderId: true,
      createdAt: true,
      attachments: {
        select: {
          id: true,
          kind: true,
          fileName: true,
          contentType: true,
          size: true,
          width: true,
          height: true,
          durationSec: true,
          waveform: true,
        },
      },
    },
  })

  await db.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  })
  await db.conversationParticipant.updateMany({
    where: { conversationId, employeeId: me },
    data: { lastReadAt: new Date() },
  })
  await db.conversationParticipant.updateMany({
    where: { conversationId, employeeId: { not: me } },
    data: { isArchived: false },
  })

  const other = await db.conversationParticipant.findFirst({
    where: { conversationId, employeeId: { not: me } },
    select: { employeeId: true },
  })
  if (other) {
    const label =
      prepared[0]?.kind === "AUDIO"
        ? "Voice message"
        : prepared[0]?.kind === "IMAGE"
          ? "Photo"
          : "File"
    await publishChat({
      type: "message",
      conversationId,
      recipientId: other.employeeId,
      messageId: message.id,
      senderId: me,
      senderName: `${session.user.firstName} ${session.user.lastName}`,
      body: caption || label,
      createdAt: message.createdAt.toISOString(),
    })
  }

  return NextResponse.json({ data: { ...message, fromMe: true } }, { status: 201 })
})
