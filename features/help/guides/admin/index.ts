import type { HelpGuide } from "../../types"
import { rolesPermissionsGuide } from "./roles-permissions"
import { auditLogGuide } from "./audit-log"
import { emailTemplatesGuide } from "./email-templates"
import { integrationsGuide } from "./integrations"
import { storageGuide } from "./storage"

export const adminGuides: HelpGuide[] = [
  rolesPermissionsGuide,
  auditLogGuide,
  emailTemplatesGuide,
  integrationsGuide,
  storageGuide,
]
