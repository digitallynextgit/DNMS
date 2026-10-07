import type { HelpGuide } from "../../types"
import { calendarGuide } from "./calendar"
import { myAttendanceGuide } from "./my-attendance"
import { myPayslipsGuide } from "./my-payslips"
import { myPerformanceGuide } from "./my-performance"
import { workFromHomeGuide } from "./work-from-home"

/** Self-service pages: My Attendance, My Payslips, My Performance, Work From Home, Calendar. In the order they are listed. */
export const selfServiceGuides: HelpGuide[] = [
  myAttendanceGuide,
  myPayslipsGuide,
  myPerformanceGuide,
  workFromHomeGuide,
  calendarGuide,
]
