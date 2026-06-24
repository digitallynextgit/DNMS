"use client"

import Link from "next/link"
import { MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getInitials, employeeSlug } from "@/lib/utils"
import { EMPLOYEE_STATUS_LABELS } from "@/lib/constants"
import { isOnProbation } from "@/features/employees/probation"

export interface EmployeeCardProps {
  employee: {
    id: string
    firstName: string
    lastName: string
    employeeNo: string
    email: string
    phone?: string | null
    designation?: { title: string } | null
    department?: { name: string } | null
    status: string
    profilePhoto?: string | null
    onProbation?: boolean
    probationMonths?: number
    dateOfJoining?: string | null
  }
  onDelete?: (id: string) => void
  canEdit?: boolean
  canDelete?: boolean
}

export function EmployeeCard({ employee, onDelete, canEdit, canDelete }: EmployeeCardProps) {
  const fullName = `${employee.firstName} ${employee.lastName}`
  const initials = getInitials(employee.firstName, employee.lastName)
  const statusLabel = EMPLOYEE_STATUS_LABELS[employee.status] ?? employee.status
  const onProbation = isOnProbation(employee)

  return (
    <Card className="group border-border bg-card relative overflow-hidden rounded-[var(--radius)] border">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-9 w-9 shrink-0">
              {employee.profilePhoto ? (
                <AvatarImage src={employee.profilePhoto} alt={fullName} />
              ) : null}
              <AvatarFallback className="bg-accent text-foreground text-xs font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0">
              <p className="text-foreground truncate text-sm leading-tight font-medium">
                {fullName}
              </p>
              {employee.designation?.title && (
                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                  {employee.designation.title}
                </p>
              )}
            </div>
          </div>

          {(canEdit || canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link
                    href={`/employees/${employeeSlug(employee.employeeNo, employee.firstName, employee.lastName)}`}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View Profile
                  </Link>
                </DropdownMenuItem>
                {canEdit && (
                  <DropdownMenuItem asChild>
                    <Link
                      href={`/employees/${employee.id}/edit`}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Link>
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive flex cursor-pointer items-center gap-2 text-sm"
                      onClick={() => onDelete?.(employee.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Terminate
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {employee.department?.name && (
          <div className="mt-3">
            <span className="bg-accent text-foreground inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium">
              {employee.department.name}
            </span>
          </div>
        )}

        <p className="text-muted-foreground mt-2 truncate text-xs">{employee.email}</p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="border-border text-muted-foreground inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium">
              {statusLabel}
            </span>
            {onProbation && (
              <span className="inline-flex items-center rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
                Probation
              </span>
            )}
          </div>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" asChild>
            <Link
              href={`/employees/${employeeSlug(employee.employeeNo, employee.firstName, employee.lastName)}`}
            >
              View
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
