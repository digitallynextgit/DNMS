"use client"

import { GettingStartedGuide } from "@/components/docs/guides/getting-started"
import { AttendanceGuide } from "@/components/docs/guides/attendance-guide"
import { LeaveGuide } from "@/components/docs/guides/leave-guide"
import { PayrollGuide } from "@/components/docs/guides/payroll-guide"
import { DocumentsGuide } from "@/components/docs/guides/documents-guide"
import { EmployeesGuide } from "@/components/docs/guides/employees-guide"
import { AdminGuide } from "@/components/docs/guides/admin-guide"

interface GuideContentProps {
  slug: string
}

export function GuideContent({ slug }: GuideContentProps) {
  switch (slug) {
    case "getting-started":
      return <GettingStartedGuide />
    case "attendance":
      return <AttendanceGuide />
    case "leave":
      return <LeaveGuide />
    case "payroll":
      return <PayrollGuide />
    case "documents":
      return <DocumentsGuide />
    case "employees":
      return <EmployeesGuide />
    case "admin":
      return <AdminGuide />
    default:
      return null
  }
}
