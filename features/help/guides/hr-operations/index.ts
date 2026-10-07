import type { HelpGuide } from "../../types"
import { leaveAdminGuide } from "./leave-admin"
import { wfhApprovalsGuide } from "./wfh-approvals"
import { stockRegisterGuide } from "./stock-register"
import { payrollGuide } from "./payroll"
import { performanceAdminGuide } from "./performance-admin"
import { recruitmentGuide } from "./recruitment"
import { analyticsGuide } from "./analytics"

/** HR: leave, WFH, stock, payroll, performance, recruitment, analytics. In the order they are listed. */
export const hrOperationsGuides: HelpGuide[] = [
  leaveAdminGuide,
  wfhApprovalsGuide,
  stockRegisterGuide,
  payrollGuide,
  performanceAdminGuide,
  recruitmentGuide,
  analyticsGuide,
]
