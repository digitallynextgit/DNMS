import "server-only"

// Poll, event and contact cards, shared by chat and project messages.
// Access is NOT checked here: each route authorises the caller for its conversation first.

import { db } from "@/server/db"

export type CardParent = { chatMessageId: string } | { projectReplyId: string }

export const POLL_SELECT = {
  select: {
    id: true,
    question: true,
    allowMultiple: true,
    closesAt: true,
    options: {
      select: {
        id: true,
        label: true,
        position: true,
        votes: {
          select: {
            voterId: true,
            voter: { select: { firstName: true, lastName: true, profilePhoto: true } },
          },
        },
      },
      orderBy: { position: "asc" },
    },
  },
} as const

export const EVENT_SELECT = {
  select: {
    id: true,
    title: true,
    startsAt: true,
    endsAt: true,
    location: true,
    notes: true,
  },
} as const

export const CONTACT_SELECT = {
  select: {
    id: true,
    employeeId: true,
    name: true,
    email: true,
    phone: true,
    designation: true,
    photo: true,
  },
} as const

export const CARD_SELECT = {
  poll: POLL_SELECT,
  event: EVENT_SELECT,
  contact: CONTACT_SELECT,
} as const

type RawPoll = {
  id: string
  question: string
  allowMultiple: boolean
  closesAt: Date | null
  options: {
    id: string
    label: string
    position: number
    votes: {
      voterId: string
      voter: { firstName: string; lastName: string; profilePhoto: string | null }
    }[]
  }[]
}

/** Shares are per VOTER, not per vote cast - the two differ in a multiple-choice poll. */
export function shapePoll(poll: RawPoll | null, viewerId: string) {
  if (!poll) return null

  const voters = new Set<string>()
  for (const o of poll.options) for (const v of o.votes) voters.add(v.voterId)
  const voterCount = voters.size

  return {
    id: poll.id,
    question: poll.question,
    allowMultiple: poll.allowMultiple,
    closesAt: poll.closesAt,
    closed: poll.closesAt ? poll.closesAt.getTime() <= Date.now() : false,
    voterCount,
    options: poll.options.map((o) => ({
      id: o.id,
      label: o.label,
      count: o.votes.length,
      share: voterCount === 0 ? 0 : Math.round((o.votes.length / voterCount) * 100),
      mine: o.votes.some((v) => v.voterId === viewerId),
      voters: o.votes.slice(0, 8).map((v) => ({
        id: v.voterId,
        firstName: v.voter.firstName,
        lastName: v.voter.lastName,
        profilePhoto: v.voter.profilePhoto,
      })),
    })),
  }
}

export interface PollInput {
  question: string
  options: string[]
  allowMultiple?: boolean
  closesAt?: string | null
}

export async function createPoll(parent: CardParent, input: PollInput) {
  const options = input.options
    .map((o) => o.trim())
    .filter(Boolean)
    .slice(0, 12)
  return db.messagePoll.create({
    data: {
      ...parent,
      question: input.question.trim().slice(0, 300),
      allowMultiple: input.allowMultiple ?? false,
      closesAt: input.closesAt ? new Date(input.closesAt) : null,
      options: {
        create: options.map((label, position) => ({ label: label.slice(0, 120), position })),
      },
    },
    ...POLL_SELECT,
  })
}

export interface EventInput {
  title: string
  startsAt: string
  endsAt?: string | null
  location?: string | null
  notes?: string | null
}

export async function createEvent(parent: CardParent, input: EventInput) {
  return db.messageEvent.create({
    data: {
      ...parent,
      title: input.title.trim().slice(0, 200),
      startsAt: new Date(input.startsAt),
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      location: input.location?.trim().slice(0, 200) || null,
      notes: input.notes?.trim().slice(0, 2000) || null,
    },
    ...EVENT_SELECT,
  })
}

/** Details are copied, not joined, so the card survives the colleague leaving. */
export async function createContact(parent: CardParent, employeeId: string) {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      profilePhoto: true,
      designation: { select: { title: true } },
    },
  })
  if (!employee) return null

  return db.messageContact.create({
    data: {
      ...parent,
      employeeId: employee.id,
      name: `${employee.firstName} ${employee.lastName}`.trim(),
      email: employee.email,
      phone: employee.phone,
      designation: employee.designation?.title ?? null,
      photo: employee.profilePhoto,
    },
    ...CONTACT_SELECT,
  })
}

/** Toggles: voting for the option you already picked withdraws the vote. */
export async function votePoll(pollId: string, optionId: string, voterId: string) {
  const poll = await db.messagePoll.findUnique({
    where: { id: pollId },
    select: {
      id: true,
      allowMultiple: true,
      closesAt: true,
      options: { select: { id: true } },
    },
  })
  if (!poll) return { error: "Poll not found" as const, status: 404 }
  if (!poll.options.some((o) => o.id === optionId)) {
    return { error: "That option is not on this poll" as const, status: 400 }
  }
  if (poll.closesAt && poll.closesAt.getTime() <= Date.now()) {
    return { error: "This poll has closed" as const, status: 409 }
  }

  const existing = await db.messagePollVote.findUnique({
    where: { optionId_voterId: { optionId, voterId } },
    select: { id: true },
  })

  if (existing) {
    await db.messagePollVote.delete({ where: { id: existing.id } })
    return { error: null, status: 200 }
  }

  if (poll.allowMultiple) {
    // A duplicate (double-tap) is a no-op.
    try {
      await db.messagePollVote.create({ data: { optionId, voterId } })
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e
    }
    return { error: null, status: 200 }
  }

  // Single-choice: Serializable, so two near-simultaneous votes for different options can't both
  // land (the unique key can't catch that). Retry a serialization conflict (P2034).
  for (let attempt = 0; ; attempt++) {
    try {
      await db.$transaction(
        async (tx) => {
          await tx.messagePollVote.deleteMany({ where: { voterId, option: { pollId } } })
          await tx.messagePollVote.create({ data: { optionId, voterId } })
        },
        { isolationLevel: "Serializable" },
      )
      return { error: null, status: 200 }
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === "P2002") return { error: null, status: 200 } // already on this option
      if (code === "P2034" && attempt < 2) continue // serialization failure - retry
      throw e
    }
  }
}

/** Which conversation a poll belongs to, so a vote can be authorised. */
export async function findPollParent(pollId: string) {
  return db.messagePoll.findUnique({
    where: { id: pollId },
    select: {
      chatMessage: { select: { conversationId: true } },
      projectReply: { select: { message: { select: { projectId: true } } } },
    },
  })
}
