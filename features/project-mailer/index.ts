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

// Merge engine: shared by the preview and the send runner, so they can't diverge.
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
