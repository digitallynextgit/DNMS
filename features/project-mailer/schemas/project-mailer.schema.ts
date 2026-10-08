import { z } from "zod"

export const mailerSettingsSchema = z.object({
  /// Shown in the "Send from" picker, e.g. "Newsletter" or "Transactional".
  name: z.string().trim().min(2, "Give this account a name").max(60),
  fromName: z.string().trim().min(1, "Sender name is required").max(80),
  fromEmail: z.string().trim().toLowerCase().email("Enter a valid sender address"),
  replyTo: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid address")
    .optional()
    .or(z.literal("")),
  host: z.string().trim().min(3, "SMTP host is required").max(120),
  port: z.coerce.number().int().min(1).max(65535).default(587),
  secure: z.boolean().default(false),
  username: z.string().trim().min(1, "Username is required").max(160),
  /** Blank on edit means "keep the stored password" - it's never sent to the browser. */
  password: z.string().max(300).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
})
export type MailerSettingsInput = z.infer<typeof mailerSettingsSchema>
export type MailerSettingsFormInput = z.input<typeof mailerSettingsSchema>

export const templateSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  subject: z.string().trim().min(2, "Subject is required").max(200),
  bodyHtml: z.string().trim().min(10, "Write the email body"),
  bodyMode: z.enum(["RICH", "HTML"]).default("RICH"),
  isActive: z.boolean().default(true),
})
export type TemplateInput = z.infer<typeof templateSchema>
export type TemplateFormInput = z.input<typeof templateSchema>

export const recipientSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  name: z.string().trim().max(120).optional().or(z.literal("")),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  tags: z.array(z.string().trim().max(40)).default([]),
  /// Arbitrary merge data. Any key here can be used as {{key}} in a template.
  fields: z.record(z.string(), z.string().max(500)).default({}),
})
export type RecipientInput = z.infer<typeof recipientSchema>

/** Paste a block of addresses; one per line, optional "Name <email>" form. */
export const recipientBulkSchema = z.object({
  raw: z.string().trim().min(3, "Paste at least one address"),
  tags: z.array(z.string().trim().max(40)).default([]),
})
export type RecipientBulkInput = z.infer<typeof recipientBulkSchema>

/** Bulk delete cap; the UI selects one page at a time, well inside it. */
export const RECIPIENT_DELETE_LIMIT = 500

export const recipientDeleteSchema = z.object({
  ids: z
    .array(z.string().uuid())
    .min(1, "Select at least one recipient")
    .max(RECIPIENT_DELETE_LIMIT, `Remove at most ${RECIPIENT_DELETE_LIMIT} at a time`),
})
export type RecipientDeleteInput = z.infer<typeof recipientDeleteSchema>

/** Max rows per import - more is a paste accident or a CRM export. */
export const IMPORT_ROW_LIMIT = 5000

/**
 * Spreadsheet import, already parsed and mapped in the browser. `email` is only shape-checked:
 * the service skips and counts bad rows instead of rejecting the whole file.
 */
export const recipientImportSchema = z.object({
  rows: z
    .array(
      z.object({
        email: z.string().trim().toLowerCase().max(200),
        name: z.string().trim().max(120).optional(),
        company: z.string().trim().max(120).optional(),
        /// Every unmapped column, usable as {{key}} in a template.
        fields: z.record(z.string(), z.string().max(500)).default({}),
      }),
    )
    .min(1, "The sheet has no rows")
    .max(IMPORT_ROW_LIMIT, `Import at most ${IMPORT_ROW_LIMIT} rows at a time`),
  tags: z.array(z.string().trim().min(1).max(40)).default([]),
  /** Re-importing usually means tagging, so existing addresses get the tags too. */
  tagExisting: z.boolean().default(true),
})
export type RecipientImportInput = z.infer<typeof recipientImportSchema>

export const campaignSchema = z.object({
  /// Required, never guessed - a wrong guess sends from the wrong domain.
  mailerId: z.string().uuid("Choose which account to send from"),
  name: z.string().trim().min(2, "Give the campaign a name").max(120),
  subject: z.string().trim().min(2, "Subject is required").max(200),
  bodyHtml: z.string().trim().min(10, "Write the email body"),
  bodyMode: z.enum(["RICH", "HTML"]).default("RICH"),
  templateId: z.string().uuid().optional().or(z.literal("")),
  /** Empty = everyone subscribed. Otherwise only recipients carrying a tag. */
  tags: z.array(z.string().trim().max(40)).default([]),
})
export type CampaignInput = z.infer<typeof campaignSchema>
export type CampaignFormInput = z.input<typeof campaignSchema>

export const testSendSchema = z.object({
  to: z.string().trim().toLowerCase().email("Enter a valid email"),
})
export type TestSendInput = z.infer<typeof testSendSchema>
