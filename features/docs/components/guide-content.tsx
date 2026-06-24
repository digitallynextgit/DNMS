"use client"

import { GettingStartedGuide } from "@/features/docs/components/guides/getting-started"
import { AttendanceGuide } from "@/features/docs/components/guides/attendance-guide"
import { LeaveGuide } from "@/features/docs/components/guides/leave-guide"
import { PayrollGuide } from "@/features/docs/components/guides/payroll-guide"
import { DocumentsGuide } from "@/features/docs/components/guides/documents-guide"
import { EmployeesGuide } from "@/features/docs/components/guides/employees-guide"
import { AdminGuide } from "@/features/docs/components/guides/admin-guide"

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
