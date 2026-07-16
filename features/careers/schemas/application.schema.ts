import { z } from "zod"

// The exact contract the marketing site posts. Kept deliberately strict: every
// string is bounded, every URL must be http(s), and `mode` mirrors the read API's
// ?mode= values. Anything outside this shape is a 422 with field details.

const MESSAGE_MAX = 2000

// Control chars (incl. NUL and ANSI escape sequences). Built via RegExp so the
// source file itself never carries raw control bytes.
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001F\\u007F]", "g")

/** Normalise a public-supplied string: drop control chars, drop angle brackets,
 *  collapse whitespace, trim.
 *
 *  `message` is free text typed by strangers, so every string is treated as
 *  hostile. React escapes on render, but stripping here keeps stored-XSS
 *  payloads and terminal escape sequences out of the DB, CSV exports and logs. */
const clean = (max: number) =>
  z
    .string()
    .transform((s) =>
      s
        .replace(CONTROL_CHARS, " ")
        .replace(/[<>]/g, "")
        .replace(/[ \t]{2,}/g, " ")
        .trim(),
    )
    .pipe(z.string().max(max))

/** http(s) URLs only - never javascript:, data: or file:. */
const httpUrl = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (v) => {
        try {
          const u = new URL(v)
          return u.protocol === "http:" || u.protocol === "https:"
        } catch {
          return false
        }
      },
      { message: "Must be a valid http(s) URL" },
    )

export const careersApplicationSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(128),
  mode: z.enum(["full-time", "internship"]),

  // Slugs published by the read API.
  groupId: clean(200).pipe(z.string().min(1)),
  departmentId: clean(200).pipe(z.string().min(1)),
  roleId: clean(200).pipe(z.string().min(1)),

  // Titles exactly as shown to the candidate.
  groupCode: clean(50).pipe(z.string().min(1)),
  departmentTitle: clean(300).pipe(z.string().min(1)),
  roleTitle: clean(300).pipe(z.string().min(1)),

  opening: clean(300).nullable().optional().default(null),

  applicant: z.object({
    fullName: clean(200).pipe(z.string().min(1)),
    email: z.string().trim().toLowerCase().email().max(320),
    phone: clean(50).pipe(z.string().min(1)),
    linkedIn: httpUrl(500),
    portfolio: httpUrl(500),
    resumeUrl: httpUrl(1000),
    // Over-long notes are TRUNCATED, never rejected - losing a real applicant
    // over a long cover letter would be the wrong trade.
    message: clean(100_000)
      .transform((s) => (s.length > MESSAGE_MAX ? s.slice(0, MESSAGE_MAX) : s))
      .nullable()
      .optional()
      .default(null),
  }),

  meta: z.object({
    submittedAt: z.string().datetime({ offset: true }),
    sourceUrl: httpUrl(1000),
  }),
})

export type CareersApplicationInput = z.infer<typeof careersApplicationSchema>
