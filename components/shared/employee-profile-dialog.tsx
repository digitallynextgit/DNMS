"use client"

/**
 * The colleague card: who this person is at work, and how to reach them.
 *
 * Fed by /api/employees/:id/card, which is an allow-list — personal contact
 * details, addresses, salary, documents and anything about employment status
 * never leave the server, so there is nothing sensitive here to hide in the UI.
 * The full HR record lives behind the employee directory and its permission.
 */

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Mail, Phone, MapPin, Building2, CalendarDays, Cake, IdCard } from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface ColleagueProfile {
  id: string
  employeeNo: string
  firstName: string
  lastName: string
  profilePhoto: string | null
  email: string | null
  phone: string | null
  workLocation: string | null
  dateOfJoining: string | null
  isActive: boolean
  department: string | null
  designation: string | null
  jobRole: string | null
  manager: {
    id: string
    firstName: string
    lastName: string
    profilePhoto: string | null
    designation: string | null
  } | null
  /** Day and month only — the server never sends the year. */
  birthday: { day: number; month: number } | null
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function EmployeeProfileDialog({
  employeeId,
  open,
  onOpenChange,
}: {
  employeeId: string | null
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { data, isPending, error } = useQuery({
    queryKey: ["employee", "card", employeeId],
    queryFn: async () =>
      (await apiFetch<{ data: { data: ColleagueProfile } }>(`/api/employees/${employeeId}/card`))
        .data.data,
    enabled: open && !!employeeId,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md lg:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Profile</DialogTitle>
        </DialogHeader>

        {isPending && (
          <div className="space-y-3">
            <Skeleton className="h-16 rounded-sm" />
            <Skeleton className="h-32 rounded-sm" />
          </div>
        )}

        {!isPending && error && (
          <p className="text-muted-foreground py-8 text-center text-xs">
            Could not load this profile.
          </p>
        )}

        {data && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <AvatarDisplay
                src={data.profilePhoto}
                firstName={data.firstName}
                lastName={data.lastName}
                size="lg"
                className="shrink-0"
              />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">
                  {data.firstName} {data.lastName}
                </p>
                {data.designation && (
                  <p className="text-muted-foreground truncate text-xs">{data.designation}</p>
                )}
                {!data.isActive && (
                  <p className="text-muted-foreground mt-0.5 text-[11px] italic">
                    No longer active
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              {/* Contact details are links, not text to copy by hand. */}
              {data.email && (
                <Row icon={Mail} label="Email">
                  <a
                    href={`mailto:${data.email}`}
                    className="truncate underline underline-offset-2"
                  >
                    {data.email}
                  </a>
                </Row>
              )}
              {data.phone && (
                <Row icon={Phone} label="Phone">
                  <a href={`tel:${data.phone}`} className="underline underline-offset-2">
                    {data.phone}
                  </a>
                </Row>
              )}
              {(data.email || data.phone) && (data.department || data.workLocation) && (
                <div className="my-1 border-t" />
              )}
              {data.department && (
                <Row icon={Building2} label="Team">
                  {data.department}
                  {data.jobRole && data.jobRole !== data.designation && ` · ${data.jobRole}`}
                </Row>
              )}
              {data.workLocation && (
                <Row icon={MapPin} label="Works from">
                  {data.workLocation}
                </Row>
              )}
              {data.dateOfJoining && (
                <Row icon={CalendarDays} label="With us since">
                  <span suppressHydrationWarning>{longDate(data.dateOfJoining)}</span>
                </Row>
              )}
              {data.birthday && (
                <Row icon={Cake} label="Birthday">
                  {data.birthday.day} {MONTHS[data.birthday.month - 1]}
                </Row>
              )}
              <Row icon={IdCard} label="Employee ID">
                {data.employeeNo}
              </Row>
            </div>

            {data.manager && (
              <div className="border-t pt-2.5">
                <p className="text-muted-foreground mb-1.5 text-[11px]">Reports to</p>
                <div className="flex items-center gap-2">
                  <AvatarDisplay
                    src={data.manager.profilePhoto}
                    firstName={data.manager.firstName}
                    lastName={data.manager.lastName}
                    size="sm"
                    className="shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {data.manager.firstName} {data.manager.lastName}
                    </p>
                    {data.manager.designation && (
                      <p className="text-muted-foreground truncate text-[11px]">
                        {data.manager.designation}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Row({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-2 py-1", className)}>
      <Icon className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
      <span className="text-muted-foreground w-[4.5rem] shrink-0 text-[11px]">{label}</span>
      <span className="min-w-0 flex-1 truncate text-xs">{children}</span>
    </div>
  )
}
