"use client"

import { use, useState } from "react"
import Link from "next/link"
import {
  ChevronLeft,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Users,
  FileText,
  ShieldCheck,
  CalendarDays,
  Wallet,
  Upload,
} from "lucide-react"
import { EmployeeLeaveTab } from "@/features/employees"
import { EmployeeSalaryTab } from "@/features/employees"
import { DocumentList } from "@/features/documents"
import { DocumentUploadDialog } from "@/features/documents"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { EmptyState } from "@/components/shared/empty-state"
import { EmployeeAdminActions } from "@/features/employees"
import { ManageRolesDialog } from "@/features/employees"
import {
  EditPersonalInfo,
  EditEmploymentDetails,
  EditAddress,
  EditEmergencyContact,
} from "@/features/employees"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { StatusBadge } from "@/components/shared/status-badge"
import { useEmployee } from "@/features/employees"
import { usePermissions } from "@/features/admin"
import { getProbationStatus } from "@/features/employees"
import { cn, getInitials, getAvatarColor, formatDate } from "@/lib/utils"
import {
  EMPLOYEE_STATUS_COLORS,
  EMPLOYEE_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  PERMISSIONS,
  PROBATION_BADGE,
} from "@/lib/constants"

interface InfoRowProps {
  label: string
  value?: string | null
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="space-y-0.5">
      <p className="text-muted-foreground text-xs tracking-wide uppercase">{label}</p>
      <p className="text-sm font-medium">{value || "-"}</p>
    </div>
  )
}

function SectionHeader({
  children,
  action,
}: {
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-foreground/80 text-sm font-semibold tracking-wider uppercase">
          {children}
        </h3>
        {action}
      </div>
      <Separator className="mb-4" />
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-48 rounded-lg" />
      <Skeleton className="h-96 rounded-lg" />
    </div>
  )
}

export default function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data, isLoading, error } = useEmployee(id)
  const { can, userId } = usePermissions()
  const [uploadOpen, setUploadOpen] = useState(false)

  if (isLoading) return <ProfileSkeleton />

  if (error || !data?.data) {
    return (
      <EmptyState
        title="Employee not found."
        action={{ label: "Back to Employees", href: "/employees/employee-directory" }}
      />
    )
  }

  const emp = data.data
  const fullName = `${emp.firstName} ${emp.lastName}`
  const initials = getInitials(emp.firstName, emp.lastName)
  const avatarBg = getAvatarColor(fullName)
  const statusLabel = EMPLOYEE_STATUS_LABELS[emp.status] ?? emp.status
  const probation = getProbationStatus(emp)
  const canUploadDocs = can(PERMISSIONS.DOCUMENT_WRITE)
  const canDeleteDocs = can(PERMISSIONS.DOCUMENT_DELETE)
  const canEdit = can(PERMISSIONS.EMPLOYEE_WRITE)

  const ca = (emp.currentAddress ?? {}) as Record<string, string>
  const pa = (emp.permanentAddress ?? {}) as Record<string, string>
  const ec = (emp.emergencyContact ?? {}) as Record<string, string>

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/employees/employee-directory" className="flex items-center gap-1.5">
          <ChevronLeft className="h-4 w-4" />
          Back to Employees
        </Link>
      </Button>

      {/* Top profile card */}
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col items-start gap-6 sm:flex-row">
            {/* Avatar */}
            <Avatar className="h-24 w-24 shrink-0">
              {/* Always mount AvatarImage (src empty when no photo) so Radix resets
                  its loading status and shows the fallback the moment a photo is
                  removed - conditionally unmounting it leaves a stale "loaded"
                  status and a blank avatar until reload. */}
              <AvatarImage src={emp.profilePhoto ?? undefined} alt={fullName} />
              <AvatarFallback className={cn("text-2xl font-bold text-white", avatarBg)}>
                {initials}
              </AvatarFallback>
            </Avatar>

            {/* Name block */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">{fullName}</h1>
                  <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-sm">
                    {emp.designation?.title && (
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5" />
                        {emp.designation.title}
                      </span>
                    )}
                    {emp.department?.name && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {emp.department.name}
                      </span>
                    )}
                  </div>
                </div>

                {(can(PERMISSIONS.EMPLOYEE_WRITE) || userId === emp.id) && (
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Photo (admin) + Resign (self only) live here; the component
                        decides which to show based on permission / ownership. */}
                    <EmployeeAdminActions
                      employeeId={emp.id}
                      status={emp.status}
                      hasPhoto={!!emp.profilePhoto}
                    />
                  </div>
                )}
              </div>

              {/* Badges row */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {emp.employeeNo}
                </Badge>
                <StatusBadge
                  status={emp.status}
                  colorMap={EMPLOYEE_STATUS_COLORS}
                  labelMap={EMPLOYEE_STATUS_LABELS}
                />
                {probation.onProbation && (
                  <StatusBadge
                    status="Probation"
                    label={`On Probation${
                      probation.endDate
                        ? ` · until ${formatDate(probation.endDate.toISOString())}`
                        : ""
                    }`}
                    colorMap={{ Probation: PROBATION_BADGE }}
                  />
                )}
              </div>

              {/* Contact row */}
              <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-4 text-sm">
                <a
                  href={`mailto:${emp.email}`}
                  className="hover:text-foreground flex items-center gap-1.5 transition-colors"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  {emp.email}
                </a>
                {emp.phone && (
                  <a
                    href={`tel:${emp.phone}`}
                    className="hover:text-foreground flex items-center gap-1.5 transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    {emp.phone}
                  </a>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList className="mb-4">
          <TabsTrigger value="info" className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            Info
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="leave" className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Leave
          </TabsTrigger>
          <TabsTrigger value="salary" className="flex items-center gap-1.5">
            <Wallet className="h-4 w-4" />
            Salary
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4" />
            Roles
          </TabsTrigger>
        </TabsList>

        {/* ── Info Tab ─────────────────────────────────────────────────────── */}
        <TabsContent value="info" className="space-y-6">
          {/* Personal Information */}
          <Card>
            <CardContent className="pt-6">
              <SectionHeader action={canEdit && <EditPersonalInfo emp={emp} />}>
                Personal Information
              </SectionHeader>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <InfoRow label="First Name" value={emp.firstName} />
                <InfoRow label="Last Name" value={emp.lastName} />
                <InfoRow label="Work Email" value={emp.email} />
                <InfoRow label="Personal Email" value={emp.personalEmail} />
                <InfoRow label="Work Phone" value={emp.phone} />
                <InfoRow label="Personal Phone" value={emp.personalPhone} />
                <InfoRow label="Date of Birth" value={formatDate(emp.dateOfBirth)} />
                <InfoRow label="Gender" value={emp.gender ?? undefined} />
                <InfoRow label="Nationality" value={emp.nationality} />
                <InfoRow label="Blood Group" value={emp.bloodGroup} />
              </div>
            </CardContent>
          </Card>

          {/* Employment Details */}
          <Card>
            <CardContent className="pt-6">
              <SectionHeader action={canEdit && <EditEmploymentDetails emp={emp} />}>
                Employment Details
              </SectionHeader>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <InfoRow label="Employee No" value={emp.employeeNo} />
                <InfoRow label="Department" value={emp.department?.name} />
                <InfoRow label="Designation" value={emp.designation?.title} />
                <InfoRow label="Job Role" value={emp.jobRole?.name} />
                <InfoRow
                  label="Employment Type"
                  value={EMPLOYMENT_TYPE_LABELS[emp.employmentType] ?? emp.employmentType}
                />
                <InfoRow label="Status" value={statusLabel} />
                <InfoRow label="Work Location" value={emp.workLocation} />
                <InfoRow label="Date of Joining" value={formatDate(emp.dateOfJoining)} />
                <InfoRow
                  label="Probation End"
                  value={
                    probation.endDate ? formatDate(probation.endDate.toISOString()) : undefined
                  }
                />
                <InfoRow
                  label="Manager"
                  value={
                    emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : undefined
                  }
                />
                <InfoRow label="Subordinates" value={String(emp._count?.subordinates ?? 0)} />
              </div>
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardContent className="pt-6">
              <SectionHeader action={canEdit && <EditAddress emp={emp} />}>Address</SectionHeader>
              {ca.line1 || pa.line1 ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="space-y-0.5">
                    <p className="text-muted-foreground text-xs tracking-wide uppercase">
                      Current Address
                    </p>
                    <p className="text-sm font-medium">
                      {[ca.line1, ca.line2, ca.city, ca.state, ca.zip].filter(Boolean).join(", ") ||
                        "-"}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-muted-foreground text-xs tracking-wide uppercase">
                      Permanent Address
                    </p>
                    <p className="text-sm font-medium">
                      {[pa.line1, pa.line2, pa.city, pa.state, pa.zip].filter(Boolean).join(", ") ||
                        "-"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No address on file.</p>
              )}
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card>
            <CardContent className="pt-6">
              <SectionHeader action={canEdit && <EditEmergencyContact emp={emp} />}>
                Emergency Contact
              </SectionHeader>
              {ec.name ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                  <InfoRow label="Name" value={ec.name} />
                  <InfoRow label="Relation" value={ec.relation} />
                  <InfoRow label="Phone" value={ec.phone} />
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No emergency contact on file.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Documents Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />
                  Documents
                </CardTitle>
                {canUploadDocs && (
                  <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
                    <Upload className="mr-2 h-3.5 w-3.5" />
                    Upload
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <DocumentList
                employeeId={emp.id}
                canUpload={canUploadDocs}
                canDelete={canDeleteDocs}
                onUploadClick={() => setUploadOpen(true)}
              />
            </CardContent>
          </Card>
          <DocumentUploadDialog
            open={uploadOpen}
            onOpenChange={setUploadOpen}
            employeeId={emp.id}
          />
        </TabsContent>

        {/* ── Leave Tab ─────────────────────────────────────────────────────── */}
        <TabsContent value="leave">
          <EmployeeLeaveTab employeeId={emp.id} />
        </TabsContent>

        {/* ── Salary Tab ────────────────────────────────────────────────────── */}
        <TabsContent value="salary">
          <EmployeeSalaryTab employeeId={emp.id} />
        </TabsContent>

        {/* ── Roles Tab ─────────────────────────────────────────────────────── */}
        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4" />
                  Assigned Roles
                </CardTitle>
                {can(PERMISSIONS.ROLE_WRITE) && (
                  <ManageRolesDialog
                    employeeId={emp.id}
                    employeeName={`${emp.firstName} ${emp.lastName}`}
                    currentRoleIds={(emp.employeeRoles ?? []).map((er) => er.role.id)}
                  />
                )}
              </div>
            </CardHeader>
            <CardContent>
              {emp.employeeRoles && emp.employeeRoles.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {emp.employeeRoles.map((er) => (
                    <Badge key={er.id} variant="secondary" className="px-3 py-1 text-sm">
                      {er.role.displayName}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No roles assigned.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
