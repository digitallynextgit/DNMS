"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Pencil, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmployeeCombobox } from "./employee-combobox"
import { DateField } from "@/components/shared/date-field"
import {
  useUpdateEmployee,
  useDepartments,
  useDesignations,
  type EmployeeDetail,
} from "@/features/employees/hooks/use-employees"
import { useJobRoles } from "@/features/employees/hooks/use-job-roles"
import { EMPLOYMENT_TYPE_LABELS, EMPLOYEE_STATUS_LABELS } from "@/lib/constants"
import { PROBATION_MONTHS_OPTIONS } from "@/features/employees/probation"

// ─── Shared bits ──────────────────────────────────────────────────────────────

function toDateInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : ""
}

/** Small "Edit" pill placed in a section header. */
function EditTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={onClick}>
      <Pencil className="h-3.5 w-3.5" />
      Edit
    </Button>
  )
}

/** Wraps the per-section dialog shell so each editor stays focused on its fields. */
function SectionDialog({
  open,
  onOpenChange,
  title,
  onSave,
  saving,
  children,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  onSave: () => void
  saving: boolean
  children: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-150">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">{children}</div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  )
}

/** Returns the first required field that is empty (label), or null if all set. */
function firstMissing(fields: Array<[value: string, label: string]>): string | null {
  const missing = fields.find(([v]) => !v.trim())
  return missing ? missing[1] : null
}

const GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
]

// Kept in step with the create form's option sets so viewing/editing matches.
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
const WORK_LOCATIONS = ["Remote", "Office", "Hybrid"]
const NATIONALITIES = [
  "Indian",
  "American",
  "Australian",
  "Bangladeshi",
  "British",
  "Canadian",
  "Chinese",
  "French",
  "German",
  "Irish",
  "Japanese",
  "Malaysian",
  "Nepalese",
  "New Zealander",
  "Pakistani",
  "Russian",
  "Singaporean",
  "South African",
  "Spanish",
  "Sri Lankan",
  "Other",
]
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ─── Personal Information ───────────────────────────────────────────────────────

export function EditPersonalInfo({ emp }: { emp: EmployeeDetail }) {
  const [open, setOpen] = useState(false)
  const mut = useUpdateEmployee()
  const [form, setForm] = useState(() => buildPersonal(emp))

  function buildPersonal(e: EmployeeDetail) {
    return {
      firstName: e.firstName ?? "",
      lastName: e.lastName ?? "",
      email: e.email ?? "",
      personalEmail: e.personalEmail ?? "",
      phone: e.phone ?? "",
      personalPhone: e.personalPhone ?? "",
      dateOfBirth: toDateInput(e.dateOfBirth),
      gender: e.gender ?? "",
      nationality: e.nationality ?? "",
      bloodGroup: e.bloodGroup ?? "",
    }
  }

  function openDialog() {
    setForm(buildPersonal(emp))
    setOpen(true)
  }

  function save() {
    const missing = firstMissing([
      [form.firstName, "First name"],
      [form.lastName, "Last name"],
      [form.email, "Work email"],
      [form.personalEmail, "Personal email"],
      [form.phone, "Work phone"],
      [form.personalPhone, "Personal phone"],
      [form.dateOfBirth, "Date of birth"],
      [form.gender, "Gender"],
      [form.nationality, "Nationality"],
    ])
    if (missing) {
      toast.error(`${missing} is required`)
      return
    }
    if (!EMAIL_RE.test(form.email.trim())) {
      toast.error("Enter a valid work email")
      return
    }
    if (!EMAIL_RE.test(form.personalEmail.trim())) {
      toast.error("Enter a valid personal email")
      return
    }
    const body: Record<string, unknown> = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      personalEmail: form.personalEmail.trim(),
      phone: form.phone.trim(),
      personalPhone: form.personalPhone.trim(),
      dateOfBirth: form.dateOfBirth,
      nationality: form.nationality.trim(),
      bloodGroup: form.bloodGroup.trim(),
    }
    if (form.gender) body.gender = form.gender // enum: omit when unset

    mut.mutate(
      { id: emp.id, body },
      {
        onSuccess: () => {
          toast.success("Personal information updated")
          setOpen(false)
        },
        onError: (e: Error) => toast.error(e.message),
      },
    )
  }

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <>
      <EditTrigger onClick={openDialog} />
      <SectionDialog
        open={open}
        onOpenChange={setOpen}
        title="Edit Personal Information"
        onSave={save}
        saving={mut.isPending}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First Name" required>
            <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
          </Field>
          <Field label="Last Name" required>
            <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
          </Field>
          <Field label="Work Email" required>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label="Personal Email" required>
            <Input
              type="email"
              value={form.personalEmail}
              onChange={(e) => set("personalEmail", e.target.value)}
            />
          </Field>
          <Field label="Work Phone" required>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Personal Phone" required>
            <Input
              value={form.personalPhone}
              onChange={(e) => set("personalPhone", e.target.value)}
            />
          </Field>
          <Field label="Date of Birth" required>
            <DateField value={form.dateOfBirth} onChange={(v) => set("dateOfBirth", v)} />
          </Field>
          <Field label="Gender" required>
            <Select value={form.gender || undefined} onValueChange={(v) => set("gender", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                {GENDER_OPTIONS.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Nationality" required>
            <Select value={form.nationality || undefined} onValueChange={(v) => set("nationality", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select nationality" />
              </SelectTrigger>
              <SelectContent>
                {NATIONALITIES.map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Blood Group">
            <Select value={form.bloodGroup || undefined} onValueChange={(v) => set("bloodGroup", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select blood group" />
              </SelectTrigger>
              <SelectContent>
                {BLOOD_GROUPS.map((bg) => (
                  <SelectItem key={bg} value={bg}>
                    {bg}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </SectionDialog>
    </>
  )
}

// ─── Employment Details ─────────────────────────────────────────────────────────

export function EditEmploymentDetails({ emp }: { emp: EmployeeDetail }) {
  const [open, setOpen] = useState(false)
  const mut = useUpdateEmployee()
  const { data: deptData } = useDepartments()
  const { data: desigData } = useDesignations()
  const departments = deptData?.data ?? []
  const designations = desigData?.data ?? []

  const [form, setForm] = useState(() => buildEmployment(emp))
  // Job roles are scoped to the selected department (mirrors the create form).
  const { data: jobRolesData } = useJobRoles({ departmentId: form.departmentId || undefined })
  const jobRoles = jobRolesData ?? []

  function buildEmployment(e: EmployeeDetail) {
    return {
      employeeNo: e.employeeNo ?? "",
      departmentId: e.department?.id ?? "",
      designationId: e.designation?.id ?? "",
      jobRoleId: e.jobRole?.id ?? "",
      managerId: e.manager?.id ?? "",
      employmentType: e.employmentType ?? "FULL_TIME",
      status: e.status ?? "ACTIVE",
      workLocation: e.workLocation ?? "",
      dateOfJoining: toDateInput(e.dateOfJoining),
      deviceId: e.deviceId ?? "",
      onProbation: !!e.onProbation,
      probationMonths: String(e.probationMonths ?? 6),
    }
  }

  function openDialog() {
    setForm(buildEmployment(emp))
    setOpen(true)
  }

  function save() {
    if (!form.employeeNo.trim()) return toast.error("Employee code is required")
    if (!form.departmentId) return toast.error("Department is required")
    if (!form.designationId) return toast.error("Designation is required")
    if (!form.dateOfJoining) return toast.error("Date of joining is required")
    if (!form.workLocation.trim()) return toast.error("Work location is required")

    const body: Record<string, unknown> = {
      employeeNo: form.employeeNo.trim(),
      employmentType: form.employmentType,
      status: form.status,
      workLocation: form.workLocation.trim(),
      dateOfJoining: form.dateOfJoining,
      deviceId: form.deviceId.trim(),
      onProbation: form.onProbation,
      probationMonths: Number(form.probationMonths),
      // Job role is optional; "" clears it. Send it explicitly so a change sticks.
      jobRoleId: form.jobRoleId,
    }
    // uuid fields: only send when set (the schema rejects empty strings).
    if (form.departmentId) body.departmentId = form.departmentId
    if (form.designationId) body.designationId = form.designationId
    if (form.managerId) body.managerId = form.managerId

    mut.mutate(
      { id: emp.id, body },
      {
        onSuccess: () => {
          toast.success("Employment details updated")
          setOpen(false)
        },
        onError: (e: Error) => toast.error(e.message),
      },
    )
  }

  return (
    <>
      <EditTrigger onClick={openDialog} />
      <SectionDialog
        open={open}
        onOpenChange={setOpen}
        title="Edit Employment Details"
        onSave={save}
        saving={mut.isPending}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Employee Code" required>
            <Input
              value={form.employeeNo}
              onChange={(e) => setForm((f) => ({ ...f, employeeNo: e.target.value }))}
              placeholder="e.g. 132"
            />
          </Field>
          <Field label="Department" required>
            <Select
              value={form.departmentId || undefined}
              onValueChange={(v) => setForm((f) => ({ ...f, departmentId: v, jobRoleId: "" }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Designation" required>
            <Select
              value={form.designationId || undefined}
              onValueChange={(v) => setForm((f) => ({ ...f, designationId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select designation" />
              </SelectTrigger>
              <SelectContent>
                {designations.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Job Role">
            <Select
              value={form.jobRoleId || "none"}
              onValueChange={(v) => setForm((f) => ({ ...f, jobRoleId: v === "none" ? "" : v }))}
              disabled={!form.departmentId}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={form.departmentId ? "Select job role (optional)" : "Pick a department first"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">- None -</SelectItem>
                {jobRoles
                  .filter((r) => r.isActive)
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="space-y-2 sm:col-span-2">
            <Label>Manager</Label>
            <EmployeeCombobox
              value={form.managerId || undefined}
              onChange={(v) => setForm((f) => ({ ...f, managerId: v ?? "" }))}
              excludeId={emp.id}
              initialLabel={
                emp.manager ? `${emp.manager.firstName} ${emp.manager.lastName}` : undefined
              }
              placeholder="Search and select a manager"
              modal
            />
          </div>
          <Field label="Employment Type" required>
            <Select
              value={form.employmentType}
              onValueChange={(v) => setForm((f) => ({ ...f, employmentType: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EMPLOYEE_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Work Location" required>
            <Select
              value={form.workLocation || undefined}
              onValueChange={(v) => setForm((f) => ({ ...f, workLocation: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select work location" />
              </SelectTrigger>
              <SelectContent>
                {WORK_LOCATIONS.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Date of Joining" required>
            <DateField
              value={form.dateOfJoining}
              onChange={(v) => setForm((f) => ({ ...f, dateOfJoining: v }))}
            />
          </Field>
          <Field label="Device ID">
            <Input
              value={form.deviceId}
              onChange={(e) => setForm((f) => ({ ...f, deviceId: e.target.value }))}
            />
          </Field>
          <Field label="Probation Length" required>
            <Select
              value={form.probationMonths}
              onValueChange={(v) => setForm((f) => ({ ...f, probationMonths: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROBATION_MONTHS_OPTIONS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m} {m === 1 ? "month" : "months"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Checkbox
              id="onProbation"
              checked={form.onProbation}
              onCheckedChange={(c) => setForm((f) => ({ ...f, onProbation: !!c }))}
            />
            <Label htmlFor="onProbation" className="mb-0 cursor-pointer">
              On probation (uncheck to confirm early)
            </Label>
          </div>
        </div>
      </SectionDialog>
    </>
  )
}

// ─── Address ────────────────────────────────────────────────────────────────────

type Addr = { line1: string; line2: string; city: string; state: string; zip: string }

function blankAddr(a: Record<string, string> | null | undefined): Addr {
  return {
    line1: a?.line1 ?? "",
    line2: a?.line2 ?? "",
    city: a?.city ?? "",
    state: a?.state ?? "",
    zip: a?.zip ?? "",
  }
}

function AddressFields({
  value,
  onChange,
  required,
}: {
  value: Addr
  onChange: (next: Addr) => void
  required?: boolean
}) {
  const set = (k: keyof Addr, v: string) => onChange({ ...value, [k]: v })
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Address Line 1" required={required}>
          <Input value={value.line1} onChange={(e) => set("line1", e.target.value)} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Address Line 2">
          <Input value={value.line2} onChange={(e) => set("line2", e.target.value)} />
        </Field>
      </div>
      <Field label="City" required={required}>
        <Input value={value.city} onChange={(e) => set("city", e.target.value)} />
      </Field>
      <Field label="State" required={required}>
        <Input value={value.state} onChange={(e) => set("state", e.target.value)} />
      </Field>
      <Field label="ZIP / Postal Code" required={required}>
        <Input value={value.zip} onChange={(e) => set("zip", e.target.value)} />
      </Field>
    </div>
  )
}

export function EditAddress({ emp }: { emp: EmployeeDetail }) {
  const [open, setOpen] = useState(false)
  const mut = useUpdateEmployee()
  const [current, setCurrent] = useState<Addr>(() => blankAddr(emp.currentAddress))
  const [permanent, setPermanent] = useState<Addr>(() => blankAddr(emp.permanentAddress))
  const [sameAsCurrent, setSameAsCurrent] = useState(false)

  function openDialog() {
    setCurrent(blankAddr(emp.currentAddress))
    setPermanent(blankAddr(emp.permanentAddress))
    setSameAsCurrent(false)
    setOpen(true)
  }

  function save() {
    // Address is required, mirroring the create form.
    const missing = firstMissing([
      [current.line1, "Current address line 1"],
      [current.city, "Current city"],
      [current.state, "Current state"],
      [current.zip, "Current ZIP / postal code"],
    ])
    if (missing) {
      toast.error(`${missing} is required`)
      return
    }
    if (!sameAsCurrent) {
      const missingPerm = firstMissing([
        [permanent.line1, "Permanent address line 1"],
        [permanent.city, "Permanent city"],
        [permanent.state, "Permanent state"],
        [permanent.zip, "Permanent ZIP / postal code"],
      ])
      if (missingPerm) {
        toast.error(`${missingPerm} is required`)
        return
      }
    }

    const perm = sameAsCurrent ? current : permanent
    mut.mutate(
      {
        id: emp.id,
        body: {
          currentAddress: { ...current, country: "India" },
          permanentAddress: { ...perm, country: "India" },
        },
      },
      {
        onSuccess: () => {
          toast.success("Address updated")
          setOpen(false)
        },
        onError: (e: Error) => toast.error(e.message),
      },
    )
  }

  return (
    <>
      <EditTrigger onClick={openDialog} />
      <SectionDialog
        open={open}
        onOpenChange={setOpen}
        title="Edit Address"
        onSave={save}
        saving={mut.isPending}
      >
        <div className="space-y-5">
          <div>
            <p className="text-foreground/80 mb-2 text-xs font-semibold tracking-wider uppercase">
              Current Address
            </p>
            <AddressFields value={current} onChange={setCurrent} required />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-foreground/80 text-xs font-semibold tracking-wider uppercase">
                Permanent Address
              </p>
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox checked={sameAsCurrent} onCheckedChange={(c) => setSameAsCurrent(!!c)} />
                <span className="text-muted-foreground text-sm">Same as current</span>
              </label>
            </div>
            {!sameAsCurrent && <AddressFields value={permanent} onChange={setPermanent} required />}
          </div>
        </div>
      </SectionDialog>
    </>
  )
}

// ─── Emergency Contact ──────────────────────────────────────────────────────────

export function EditEmergencyContact({ emp }: { emp: EmployeeDetail }) {
  const [open, setOpen] = useState(false)
  const mut = useUpdateEmployee()
  const ec = emp.emergencyContact
  const [form, setForm] = useState(() => ({
    name: ec?.name ?? "",
    relation: ec?.relation ?? "",
    phone: ec?.phone ?? "",
  }))

  function openDialog() {
    setForm({
      name: emp.emergencyContact?.name ?? "",
      relation: emp.emergencyContact?.relation ?? "",
      phone: emp.emergencyContact?.phone ?? "",
    })
    setOpen(true)
  }

  function save() {
    mut.mutate(
      {
        id: emp.id,
        body: {
          emergencyContact: {
            name: form.name.trim(),
            relation: form.relation.trim(),
            phone: form.phone.trim(),
          },
        },
      },
      {
        onSuccess: () => {
          toast.success("Emergency contact updated")
          setOpen(false)
        },
        onError: (e: Error) => toast.error(e.message),
      },
    )
  }

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <>
      <EditTrigger onClick={openDialog} />
      <SectionDialog
        open={open}
        onOpenChange={setOpen}
        title="Edit Emergency Contact"
        onSave={save}
        saving={mut.isPending}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Relation">
            <Input value={form.relation} onChange={(e) => set("relation", e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
        </div>
      </SectionDialog>
    </>
  )
}
