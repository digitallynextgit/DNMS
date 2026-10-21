"use client"

import { ClipboardList, Upload, UserCircle } from "lucide-react"

import { Link } from "@/components/tenant-link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { usePermissions } from "@/features/admin/hooks/use-permissions"
import { PERMISSIONS } from "@/lib/constants"
import { formatDate } from "@/lib/utils"

export interface RecentJoiner {
  id: string
  firstName: string
  lastName: string
  profilePhoto: string | null
  designation: string | null
  department: string | null
  dateOfJoining: string | null
}

/** The newest people, with their role and joining date; each opens their profile. */
export function RecentJoinersCard({ joiners }: { joiners: RecentJoiner[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Recent Joiners</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {joiners.length === 0 ? (
          <EmptyState title="No recent joiners." compact />
        ) : (
          <ul className="divide-border divide-y">
            {joiners.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/employees/${e.id}`}
                  className="hover:bg-muted/40 flex items-center gap-3 px-5 py-3 transition-colors"
                >
                  <AvatarDisplay
                    src={e.profilePhoto}
                    firstName={e.firstName}
                    lastName={e.lastName}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {e.firstName} {e.lastName}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {e.designation ?? "-"}
                      {e.department ? ` · ${e.department}` : ""}
                    </span>
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {formatDate(e.dateOfJoining)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/** HR shortcuts, each shown only to people who may use it. */
export function HrQuickActions() {
  const { can } = usePermissions()
  const actions = [
    can(PERMISSIONS.EMPLOYEE_WRITE) && {
      href: "/employees/new",
      label: "Add New Employee",
      icon: UserCircle,
    },
    can(PERMISSIONS.DOCUMENT_WRITE) && {
      href: "/documents",
      label: "Upload Document",
      icon: Upload,
    },
    can(PERMISSIONS.AUDIT_READ) && {
      href: "/admin/audit-log",
      label: "View Audit Log",
      icon: ClipboardList,
    },
  ].filter(Boolean) as { href: string; label: string; icon: React.ElementType }[]
  if (actions.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.map((a) => (
          <Button key={a.href} asChild variant="outline" className="w-full justify-start gap-2">
            <Link href={a.href}>
              <a.icon className="text-muted-foreground h-4 w-4" />
              <span>{a.label}</span>
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  )
}
