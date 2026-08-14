// Public API for the "project-mailer" feature (CLAUDE.md §1, rule #2).
// Server-only modules are NOT re-exported - API routes import those directly,
// so nothing drags `server-only` into a client bundle.

export {
  mailerSettingsSchema,
  templateSchema,
  recipientSchema,
  recipientBulkSchema,
  campaignSchema,
  testSendSchema,
  type MailerSettingsInput,
  type MailerSettingsFormInput,
  type TemplateInput,
  type TemplateFormInput,
  type RecipientInput,
  type RecipientBulkInput,
  type CampaignInput,
  type CampaignFormInput,
  type TestSendInput,
} from "./schemas/project-mailer.schema"

export { ProjectMailerTab } from "./components/project-mailer-tab"

// Merge engine - client-safe, shared by the compose preview and the send runner
// so a preview cannot diverge from what actually goes out.
export {
  BUILTIN_VARS,
  extractVars,
  buildVars,
  renderMerge,
  previewVars,
  type MergeSource,
} from "./lib/merge"

export { BodyComposer, type BodyMode } from "./components/body-composer"
export { EmailPreview } from "./components/email-preview"
export { RichTextEditor } from "./components/rich-text-editor"
