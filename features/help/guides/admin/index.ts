import type { HelpGuide } from "../../types"
import { rolesPermissionsGuide } from "./roles-permissions"
import { auditLogGuide } from "./audit-log"
import { emailTemplatesGuide } from "./email-templates"
import { integrationsGuide } from "./integrations"
import { storageGuide } from "./storage"

/** Admin: roles & permissions, audit log, email templates, integrations, storage. In the order they are listed. */
export const adminGuides: HelpGuide[] = [
  rolesPermissionsGuide,
  auditLogGuide,
  emailTemplatesGuide,
  integrationsGuide,
  storageGuide,
]
