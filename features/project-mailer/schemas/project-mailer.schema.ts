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
  /**
   * Blank on edit means "keep the stored password". The saved value is never
   * sent back to the browser, so an empty field cannot mean "clear it" - that
   * would wipe working credentials every time somebody edited the From name.
   */
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

/**
 * One import can carry this many rows. A real subscriber list is well under it;
 * anything larger is a paste accident or a whole CRM export, and it would sit in
 * one request body and one transaction.
 */
export const IMPORT_ROW_LIMIT = 5000

/**
 * Spreadsheet import. The file is parsed in the BROWSER and arrives here already
 * mapped to columns, so the person could see which column was the email address
 * before committing - importing the wrong column silently mails the wrong people.
 *
 * NOTE: `email` is only shape-checked here, not validated as an address. A single
 * malformed cell in row 400 must not reject the other 399; the service counts
 * them as skipped and reports back instead.
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
  /**
   * Addresses already on the list get the new tags too. On by default because the
   * usual reason to re-import a list is to tag it - skipping them would look like
   * the import did nothing.
   */
  tagExisting: z.boolean().default(true),
})
export type RecipientImportInput = z.infer<typeof recipientImportSchema>

export const campaignSchema = z.object({
  /// Which SMTP account sends this. Required - never guessed, because guessing
  /// wrong means the mail goes out from the wrong domain.
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
