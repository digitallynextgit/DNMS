import { z } from "zod"

/** An ISO date-time string; the form sends what `Date.toISOString()` gives. */
const dateTime = z
  .string()
  .trim()
  .refine((s) => !Number.isNaN(Date.parse(s)), "Enter a valid date and time")

const text = (max: number) => z.string().trim().max(max).optional().or(z.literal(""))

export const voteOptionSchema = z
  .object({
    /** An employee option; null or missing = a custom entry named by `label`. */
    employeeId: z.string().trim().min(1).optional().nullable(),
    /** Required for a custom entry; defaults to the employee's name otherwise. */
    label: text(120),
    description: text(300),
  })
  .refine((o) => Boolean(o.employeeId) || Boolean(o.label), {
    message: "Pick an employee or type a name",
    path: ["label"],
  })
export type VoteOptionInput = z.infer<typeof voteOptionSchema>
export type VoteOptionFormInput = z.input<typeof voteOptionSchema>

export const voteOptionUpdateSchema = z.object({
  label: z.string().trim().min(1, "Give the option a name").max(120),
  description: text(300),
})
export type VoteOptionUpdateInput = z.infer<typeof voteOptionUpdateSchema>

const eventFields = {
  title: z.string().trim().min(3, "Give the event a name").max(120),
  description: text(2000),
  /** Empty = opens the moment it is published. */
  opensAt: dateTime.optional().or(z.literal("")),
  closesAt: dateTime,
}

export const voteEventSchema = z
  .object({
    ...eventFields,
    options: z.array(voteOptionSchema).max(100).default([]),
    /** Put every active employee (admins left out) on the ballot. */
    allEmployees: z.boolean().default(false),
    /** Let voters change a cast vote while voting is open. Off = the first vote is final. */
    allowVoteChange: z.boolean().default(false),
  })
  .refine((e) => !e.opensAt || Date.parse(e.opensAt) < Date.parse(e.closesAt), {
    message: "Voting must close after it opens",
    path: ["closesAt"],
  })
export type VoteEventInput = z.infer<typeof voteEventSchema>
export type VoteEventFormInput = z.input<typeof voteEventSchema>

export const voteEventUpdateSchema = z.object({
  title: eventFields.title.optional(),
  description: eventFields.description,
  opensAt: eventFields.opensAt,
  closesAt: dateTime.optional(),
  /** true publishes now (and notifies voters); false pulls it back to draft while nobody has voted. */
  publish: z.boolean().optional(),
  /** true closes voting now; false reopens it while the closing time is still ahead. */
  close: z.boolean().optional(),
  /** Turn changing a cast vote on or off; votes already cast stay as they are. */
  allowVoteChange: z.boolean().optional(),
})
export type VoteEventUpdateInput = z.infer<typeof voteEventUpdateSchema>

export const ballotSchema = z.object({ optionId: z.string().trim().min(1) })
export type BallotInput = z.infer<typeof ballotSchema>
