"use client"

import { PageHeader } from "@/components/shared/page-header"
import { ApplyLeaveForm } from "@/components/leave/apply-leave-form"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function ApplyLeavePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Apply for Leave"
        description="Submit a new leave request for approval."
        actions={
          <Button variant="outline" asChild>
            <Link href="/leave" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Leave
            </Link>
          </Button>
        }
      />

      <ApplyLeaveForm />
    </div>
  )
}
