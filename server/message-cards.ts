import "server-only"

// =============================================================================
// Polls, events and shared contacts - the WhatsApp-style cards that are not files.
// =============================================================================
// Personal chat and project messages need identical behaviour here, so this is
// one module rather than a copy in each feature. Everything below works on
// whichever parent it is handed: a chat message or a project reply.
//
// Access is NOT decided here. Each surface's route proves the caller may write
// to that conversation first, then calls in - mixing the two would leave one
// authorisation path per card type and no single place to review.
// =============================================================================

import { db } from "@/server/db"

/** Which conversation a card hangs off. Exactly one field is ever set. */
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

/** Every card kind in one spread, for a message select. */
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

/**
 * Turn raw vote rows into what a poll card draws: a count and a share per
 * option, plus whether YOU picked it.
 *
 * Shares are computed against the number of PEOPLE who voted, not the number of
 * votes cast - in a multiple-choice poll those differ, and dividing by votes
 * would show percentages that add up to more than a whole.
 */
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
      // Enough to show a row of faces under an option without another request.
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

/** Create a poll on an existing message. Options keep the order they were typed. */
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

/**
 * Share a colleague's card.
 *
 * The details are copied in, not joined: the card is a statement about who that
 * person was when it was sent, and should not blank out when they leave.
 */
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

/**
 * Cast (or withdraw) a vote.
 *
 * Toggling: clicking the option you already picked takes the vote back, which is
 * the only way to change your mind in a single-choice poll without a separate
 * "clear" control.
 */
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

  await db.$transaction(async (tx) => {
    // Single-choice means exactly that: the previous pick goes before the new
    // one lands, in the same transaction so the poll is never briefly showing
    // two votes from one person.
    if (!poll.allowMultiple) {
      await tx.messagePollVote.deleteMany({
        where: { voterId, option: { pollId } },
      })
    }
    await tx.messagePollVote.create({ data: { optionId, voterId } })
  })

  return { error: null, status: 200 }
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
