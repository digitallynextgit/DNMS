"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Mail,
  Phone,
  Building2,
  Briefcase,
  Users,
  FileText,
  ShieldCheck,
  Loader2,
  Eye,
  EyeOff,
  Shield,
  Send,
  CheckCircle2,
  Upload,
  Pencil,
  Trash2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { StatusBadge } from "@/components/shared/status-badge"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { ProfileSelfActions } from "@/features/employees"
import { DocumentList } from "@/features/documents"
import { DocumentUploadDialog } from "@/features/documents"
import { useSession } from "next-auth/react"
import { useEmployee } from "@/features/employees"
import { formatDate } from "@/lib/utils"
import { getProbationStatus } from "@/features/employees"
import {
  EMPLOYEE_STATUS_COLORS,
  EMPLOYEE_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  PROBATION_BADGE,
} from "@/lib/constants"

async function changePassword(body: { currentPassword: string; newPassword: string }) {
  const res = await fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? "Failed")
  return data
}

async function saveGmailAppPassword(body: { gmailAppPassword: string }) {
  const res = await fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? "Failed")
  return data
}

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

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-foreground/80 mb-3 text-sm font-semibold tracking-wider uppercase">
        {children}
      </h3>
      <Separator className="mb-4" />
    </div>
  )
}

export default function ProfilePage() {
  const { data: session, status: sessionStatus } = useSession()
  const userId = session?.user?.id ?? null

  const { data, isLoading, error, refetch } = useEmployee(userId)

  const [pwForm, setPwForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [showPw, setShowPw] = useState(false)

  const [gmailPw, setGmailPw] = useState("")
  const [showGmailPw, setShowGmailPw] = useState(false)
  // When a password is already set we show a "Change / Delete" panel; editing
  // reveals the input. `gmailConfirm` drives the are-you-sure dialogs.
  const [editingGmail, setEditingGmail] = useState(false)
  const [gmailConfirm, setGmailConfirm] = useState<"change" | "delete" | null>(null)

  const [docUploadOpen, setDocUploadOpen] = useState(false)

  const pwMut = useMutation({
    mutationFn: () =>
      changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
    onSuccess: () => {
      toast.success("Password changed")
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const gmailMut = useMutation({
    mutationFn: () => saveGmailAppPassword({ gmailAppPassword: gmailPw.replace(/\s+/g, "") }),
    onSuccess: () => {
      toast.success("Gmail App Password saved")
      setGmailPw("")
      setEditingGmail(false)
      refetch()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const gmailDeleteMut = useMutation({
    // Sending an empty value clears the stored password (route sets it to null).
    mutationFn: () => saveGmailAppPassword({ gmailAppPassword: "" }),
    onSuccess: () => {
      toast.success("Gmail App Password removed")
      setGmailPw("")
      setEditingGmail(false)
      setGmailConfirm(null)
      refetch()
    },
    onError: (err: Error) => {
      toast.error(err.message)
      setGmailConfirm(null)
    },
  })

  const gmailPwStripped = gmailPw.replace(/\s+/g, "")
  const gmailPwValid = gmailPwStripped.length === 16

  if (sessionStatus === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!data?.data || error) {
    return (
      <div className="text-muted-foreground flex items-center justify-center py-24 text-sm">
        Could not load your profile. Please try again later.
      </div>
    )
  }

  const emp = data.data
  const hasGmail = Boolean((emp as { hasGmailAppPassword?: boolean }).hasGmailAppPassword)
  const fullName = `${emp.firstName} ${emp.lastName}`
  // Probation end is derived (dateOfJoining + probationMonths); the raw DB column
  // is unused, so compute it the same way the admin/HR employee page does.
  const probation = getProbationStatus(emp)

  const ca = (emp.currentAddress ?? {}) as Record<string, string>
  const pa = (emp.permanentAddress ?? {}) as Record<string, string>
  const ec = (emp.emergencyContact ?? {}) as Record<string, string>

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="View and manage your personal profile"
        actions={
          <ProfileSelfActions
            employeeId={emp.id}
            hasPhoto={!!emp.profilePhoto}
            status={emp.status}
          />
        }
      />

      {/* Top card */}
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col items-start gap-6 sm:flex-row">
            <AvatarDisplay
              src={emp.profilePhoto}
              firstName={emp.firstName}
              lastName={emp.lastName}
              size="2xl"
              className="shrink-0"
            />

            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold tracking-tight">{fullName}</h2>

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
          <TabsTrigger value="roles" className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-1.5">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* Info tab */}
        <TabsContent value="info" className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <SectionHeader>Personal Information</SectionHeader>
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

          <Card>
            <CardContent className="pt-6">
              <SectionHeader>Employment Details</SectionHeader>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <InfoRow label="Employee No" value={emp.employeeNo} />
                <InfoRow label="Department" value={emp.department?.name} />
                <InfoRow label="Designation" value={emp.designation?.title} />
                <InfoRow
                  label="Employment Type"
                  value={EMPLOYMENT_TYPE_LABELS[emp.employmentType] ?? emp.employmentType}
                />
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
              </div>
            </CardContent>
          </Card>

          {(ca.line1 || pa.line1) && (
            <Card>
              <CardContent className="pt-6">
                <SectionHeader>Address</SectionHeader>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {ca.line1 && (
                    <div className="space-y-0.5">
                      <p className="text-muted-foreground text-xs tracking-wide uppercase">
                        Current Address
                      </p>
                      <p className="text-sm font-medium">
                        {[ca.line1, ca.line2, ca.city, ca.state, ca.zip].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  )}
                  {pa.line1 && (
                    <div className="space-y-0.5">
                      <p className="text-muted-foreground text-xs tracking-wide uppercase">
                        Permanent Address
                      </p>
                      <p className="text-sm font-medium">
                        {[pa.line1, pa.line2, pa.city, pa.state, pa.zip].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {ec.name && (
            <Card>
              <CardContent className="pt-6">
                <SectionHeader>Emergency Contact</SectionHeader>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                  <InfoRow label="Name" value={ec.name} />
                  <InfoRow label="Relation" value={ec.relation} />
                  <InfoRow label="Phone" value={ec.phone} />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Documents tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />
                  My Documents
                </CardTitle>
                <Button size="sm" onClick={() => setDocUploadOpen(true)}>
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  Upload Document
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <DocumentList
                employeeId={emp.id}
                canUpload
                canDelete={false}
                onUploadClick={() => setDocUploadOpen(true)}
              />
            </CardContent>
          </Card>

          <DocumentUploadDialog
            open={docUploadOpen}
            onOpenChange={setDocUploadOpen}
            employeeId={emp.id}
          />
        </TabsContent>

        {/* Roles tab */}
        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" />
                My Roles
              </CardTitle>
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

        {/* Security tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" />
                Change Password
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Current Password</Label>
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    value={pwForm.currentPassword}
                    onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input
                  type={showPw ? "text" : "password"}
                  value={pwForm.newPassword}
                  onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
                  placeholder="Min. 8 characters"
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm New Password</Label>
                <Input
                  type={showPw ? "text" : "password"}
                  value={pwForm.confirmPassword}
                  onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                  placeholder="Repeat new password"
                />
                {pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword && (
                  <p className="text-destructive text-xs">Passwords do not match</p>
                )}
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => pwMut.mutate()}
                  disabled={
                    pwMut.isPending ||
                    !pwForm.currentPassword ||
                    !pwForm.newPassword ||
                    pwForm.newPassword !== pwForm.confirmPassword
                  }
                >
                  {pwMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Gmail App Password - used to send emails from this employee's address. */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Send className="h-4 w-4" />
                Gmail App Password
              </CardTitle>
              <p className="text-muted-foreground text-xs">
                Lets HRMS send emails from your <span className="font-medium">{emp.email}</span>{" "}
                address. Stored encrypted (AES-256-GCM) - never shown back to you after save.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {hasGmail && !editingGmail ? (
                /* Password already set → status + Change / Delete actions. */
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>App Password is set.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setGmailConfirm("change")}>
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      Change
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setGmailConfirm("delete")}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              ) : (
                /* No password yet, or editing → show the input form. */
                <>
                  <div className="space-y-2">
                    <Label>{hasGmail ? "New App Password" : "App Password"}</Label>
                    <div className="relative">
                      <Input
                        type={showGmailPw ? "text" : "password"}
                        value={gmailPw}
                        onChange={(e) => setGmailPw(e.target.value)}
                        placeholder="abcd efgh ijkl mnop"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGmailPw((s) => !s)}
                        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                      >
                        {showGmailPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {gmailPw && !gmailPwValid && (
                      <p className="text-destructive text-xs">
                        Must be 16 characters (currently {gmailPwStripped.length})
                      </p>
                    )}
                    <p className="text-muted-foreground text-xs">
                      Generate at{" "}
                      <a
                        href="https://myaccount.google.com/apppasswords"
                        target="_blank"
                        rel="noreferrer noopener"
                        className="underline"
                      >
                        myaccount.google.com → Security → App Passwords
                      </a>
                      . Requires 2FA on your Google account.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2">
                    {hasGmail && editingGmail && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingGmail(false)
                          setGmailPw("")
                          setShowGmailPw(false)
                        }}
                        disabled={gmailMut.isPending}
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      onClick={() => gmailMut.mutate()}
                      disabled={gmailMut.isPending || !gmailPwValid}
                    >
                      {gmailMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {hasGmail ? "Update App Password" : "Save App Password"}
                    </Button>
                  </div>
                </>
              )}

              <ConfirmDialog
                open={gmailConfirm === "change"}
                onOpenChange={(o) => !o && setGmailConfirm(null)}
                title="Change Gmail App Password?"
                description="You'll enter a new App Password. The current one will be replaced once you save."
                confirmLabel="Continue"
                onConfirm={() => {
                  setEditingGmail(true)
                  setGmailPw("")
                  setGmailConfirm(null)
                }}
              />

              <ConfirmDialog
                open={gmailConfirm === "delete"}
                onOpenChange={(o) => !o && setGmailConfirm(null)}
                title="Remove Gmail App Password?"
                description="HRMS will no longer be able to send emails from your address. You can add a new one anytime."
                confirmLabel="Delete"
                variant="destructive"
                isLoading={gmailDeleteMut.isPending}
                onConfirm={() => gmailDeleteMut.mutate()}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
