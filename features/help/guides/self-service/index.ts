import type { HelpGuide } from "../../types"
import { calendarGuide } from "./calendar"
import { myAttendanceGuide } from "./my-attendance"
import { myPayslipsGuide } from "./my-payslips"
import { myPerformanceGuide } from "./my-performance"
import { workFromHomeGuide } from "./work-from-home"

export const selfServiceGuides: HelpGuide[] = [
  myAttendanceGuide,
  myPayslipsGuide,
  myPerformanceGuide,
  workFromHomeGuide,
  calendarGuide,
]
