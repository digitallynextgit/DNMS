import type { HelpGuide } from "../../types"
import { employeeDirectoryGuide } from "./employee-directory"
import { departmentsGuide } from "./departments"
import { designationsJobRolesGuide } from "./designations-job-roles"
import { onboardingGuide } from "./onboarding"
import { exitClearanceGuide } from "./exit-clearance"
import { resignationsGuide } from "./resignations"
import { attendanceAdminGuide } from "./attendance-admin"
import { holidaysAdminGuide } from "./holidays-admin"

export const hrPeopleGuides: HelpGuide[] = [
  employeeDirectoryGuide,
  departmentsGuide,
  designationsJobRolesGuide,
  onboardingGuide,
  exitClearanceGuide,
  resignationsGuide,
  attendanceAdminGuide,
  holidaysAdminGuide,
]
