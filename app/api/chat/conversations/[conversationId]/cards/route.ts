import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { publishChat } from "@/server/chat-stream"
import { createPoll, createEvent, createContact } from "@/server/message-cards"

export const runtime = "nodejs"

// Creates the message and the card together; a card without a message wouldn't show in the thread.
export const POST = withSession(async (req: NextRequest, ctx, session) => {
  const conversationId = ctx.params.conversationId
  const me = session.user.id

  const member = await db.conversationParticipant.findUnique({
    where: { conversationId_employeeId: { conversationId, employeeId: me } },
    select: { conversationId: true },
  })
  if (!member) return NextResponse.json({ error: "Conversation not found" }, { status: 404 })

  const body = await req.json()
  const kind = String(body?.kind ?? "")

  // The body doubles as the conversation-list preview.
  const preview =
    kind === "poll"
      ? `Poll: ${String(body.question ?? "").slice(0, 80)}`
      : kind === "event"
        ? `Event: ${String(body.title ?? "").slice(0, 80)}`
        : kind === "contact"
          ? "Contact"
          : ""
  if (!preview) return NextResponse.json({ error: "Unknown card type" }, { status: 400 })

  const message = await db.chatMessage.create({
    data: { conversationId, senderId: me, body: preview },
    select: { id: true, createdAt: true },
  })

  try {
    if (kind === "poll") {
      const options = Array.isArray(body.options) ? body.options.map(String) : []
      if (
        !String(body.question ?? "").trim() ||
        options.filter((o: string) => o.trim()).length < 2
      ) {
        throw new Error("A poll needs a question and at least two options")
      }
      await createPoll(
        { chatMessageId: message.id },
        {
          question: String(body.question),
          options,
          allowMultiple: !!body.allowMultiple,
          closesAt: body.closesAt ?? null,
        },
      )
    } else if (kind === "event") {
      if (!String(body.title ?? "").trim() || !body.startsAt) {
        throw new Error("An event needs a title and a start time")
      }
      await createEvent(
        { chatMessageId: message.id },
        {
          title: String(body.title),
          startsAt: String(body.startsAt),
          endsAt: body.endsAt ?? null,
          location: body.location ?? null,
          notes: body.notes ?? null,
        },
      )
    } else {
      const created = await createContact({ chatMessageId: message.id }, String(body.employeeId))
      if (!created) throw new Error("That person no longer exists")
    }
  } catch (err) {
    // A message without its card is an empty bubble, so remove it.
    await db.chatMessage.delete({ where: { id: message.id } }).catch(() => {})
    const reason = err instanceof Error ? err.message : "Could not create that"
    return NextResponse.json({ error: reason }, { status: 400 })
  }

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
    await publishChat({
      type: "message",
      conversationId,
      recipientId: other.employeeId,
      messageId: message.id,
      senderId: me,
      senderName: `${session.user.firstName} ${session.user.lastName}`,
      body: preview,
      createdAt: message.createdAt.toISOString(),
    })
  }

  return NextResponse.json({ data: { id: message.id } }, { status: 201 })
})
