"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { getEmployeeDocuments, deleteEmployeeDocument } from "@/features/documents"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Upload,
  FileText,
  Trash2,
  X,
  Calendar as CalendarIcon,
  List,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { usePermissions } from "@/features/admin"
import { getProbationStatus, PROBATION_MONTHS_OPTIONS } from "@/features/employees/probation"
import { cn, formatDate, employeeSlug } from "@/lib/utils"
import {
  EMPLOYMENT_TYPE_LABELS,
  DOCUMENT_CATEGORY_LABELS,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE,
} from "@/lib/constants"
import {
  useCreateEmployee,
  useUpdateEmployee,
  useEmployee,
  useEmployeeCodes,
  useDepartments,
  useDesignations,
  useEmailAvailability,
  type EmailAvailability,
} from "@/features/employees/hooks/use-employees"
import { EmployeeCombobox } from "@/features/employees/components/employee-combobox"

// ─── Schema ──────────────────────────────────────────────────────────────────

const formSchema = z.object({
  // Step 1 - Personal (all required)
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().min(1, "Work email is required").email("Valid work email is required"),
  personalEmail: z.string().min(1, "Personal email is required").email("Enter a valid email"),
  phone: z.string().min(1, "Work phone is required"),
  personalPhone: z.string().min(1, "Personal phone is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  // Kept as a constrained string (the Select only offers the four valid values)
  // so the required check is a simple non-empty rule that plays well with RHF.
  gender: z.string().min(1, "Gender is required"),
  nationality: z.string().min(1, "Nationality is required"),
  bloodGroup: z.string().optional(),

  // Step 2 - Employment (required core fields)
  departmentId: z.string().min(1, "Department is required"),
  designationId: z.string().min(1, "Designation is required"),
  managerId: z.string().optional(),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"]),
  dateOfJoining: z.string().min(1, "Date of joining is required"),
  probationEndDate: z.string().optional(),
  onProbation: z.boolean().optional(),
  probationMonths: z.enum(["0", "1", "2", "3", "4", "5", "6"]).optional(),
  workLocation: z.string().min(1, "Work location is required"),
  deviceId: z.string().optional(),
  // Required employee code (HR-system code, e.g. 132). Must be unique.
  employeeNo: z.string().min(1, "Employee code is required").max(32, "Max 32 characters"),
  // Login password (create only). Auto-filled with a generated value; editable.
  // Required-on-create is enforced in goNext().
  password: z
    .string()
    .optional()
    .refine((s) => s == null || s === "" || s.length >= 8, {
      message: "Password must be at least 8 characters",
    }),
  // Force the new hire to set their own password on first login.
  mustChangePassword: z.boolean().optional(),
  // Format check only - required-on-create is enforced in goNext() so edit mode
  // can leave the field blank to mean "leave unchanged".
  gmailAppPassword: z
    .string()
    .optional()
    .refine((s) => s == null || s === "" || s.replace(/\s+/g, "").length === 16, {
      message: "Gmail App Password must be 16 characters",
    }),

  // Step 3 - Address
  currentLine1: z.string().optional(),
  currentLine2: z.string().optional(),
  currentCity: z.string().optional(),
  currentState: z.string().optional(),
  currentZip: z.string().optional(),
  sameAsCurrent: z.boolean(),
  permanentLine1: z.string().optional(),
  permanentLine2: z.string().optional(),
  permanentCity: z.string().optional(),
  permanentState: z.string().optional(),
  permanentZip: z.string().optional(),

  // Emergency
  emergencyName: z.string().optional(),
  emergencyRelation: z.string().optional(),
  emergencyPhone: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

// ─── Nationality options (Indian first / default) ─────────────────────────────

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
] as const

// ─── Work location options ─────────────────────────────────────────────────────

const WORK_LOCATIONS = ["Remote", "Office", "Hybrid"] as const

// Convert between the form's "yyyy-MM-dd" string and a Date for the calendar,
// staying in local time so the day never shifts across timezones.
function parseDateString(s?: string): Date | undefined {
  if (!s) return undefined
  const [y, m, d] = s.split("-").map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

// Generate a readable, reasonably strong password for a new hire. Avoids
// ambiguous characters (0/O, 1/l/I) and guarantees a mix of classes.
function generatePassword(length = 12): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
  const lower = "abcdefghijkmnpqrstuvwxyz"
  const digits = "23456789"
  const symbols = "@#$%&*?"
  const all = upper + lower + digits + symbols
  const rand = (set: string) => set[Math.floor(Math.random() * set.length)]
  const out = [rand(upper), rand(lower), rand(digits), rand(symbols)]
  for (let i = out.length; i < length; i++) out.push(rand(all))
  // Shuffle so the guaranteed classes aren't always in the first 4 positions.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out.join("")
}

// Smallest positive integer not already used as a (purely numeric) employee code,
// e.g. codes 1,2,3 → "4"; codes 1,3 → "2".
function nextEmployeeCode(codes: string[]): string {
  const used = new Set<number>()
  for (const c of codes) {
    const trimmed = c.trim()
    const n = parseInt(trimmed, 10)
    if (!Number.isNaN(n) && String(n) === trimmed) used.add(n)
  }
  let n = 1
  while (used.has(n)) n++
  return String(n)
}

// ─── Reusable date picker (shadcn calendar in a popover) ───────────────────────

function DateField({
  value,
  onChange,
  placeholder = "Pick a date",
  startMonth,
  endMonth,
  disabled,
}: {
  value?: string
  onChange: (v: string) => void
  placeholder?: string
  startMonth?: Date
  endMonth?: Date
  disabled?: (date: Date) => boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "border-input h-10 w-full justify-start rounded px-3 text-left font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? formatDate(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          captionLayout="dropdown"
          startMonth={startMonth}
          endMonth={endMonth}
          defaultMonth={parseDateString(value)}
          selected={parseDateString(value)}
          onSelect={(date) => {
            onChange(date ? toDateString(date) : "")
            if (date) setOpen(false)
          }}
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  )
}

// ─── Step config ──────────────────────────────────────────────────────────────

const STEPS = [
  { number: 1, label: "Personal Info" },
  { number: 2, label: "Employment" },
  { number: 3, label: "Documents" },
  { number: 4, label: "Address & Emergency" },
  { number: 5, label: "Review & Submit" },
]

// ─── Document step state ──────────────────────────────────────────────────────

type DocCategory = keyof typeof DOCUMENT_CATEGORY_LABELS

interface PendingDoc {
  /** Local-only id for keying. */
  uid: string
  file: File
  title: string
  category: DocCategory
  expiresAt?: string
}

interface ExistingDoc {
  id: string
  title: string
  category: string
  fileName: string
  fileSize: number
  mimeType: string
  createdAt: string
}

async function fetchEmployeeDocs(employeeId: string): Promise<{ data: ExistingDoc[] }> {
  const r = await getEmployeeDocuments(employeeId)
  if (!r.ok) throw new Error(r.error)
  return r.data as { data: ExistingDoc[] }
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface EmployeeFormProps {
  mode: "create" | "edit"
  employeeId?: string
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ steps, currentStep }: { steps: typeof STEPS; currentStep: number }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-0">
      {steps.map((step, index) => {
        const isCompleted = currentStep > step.number
        const isActive = currentStep === step.number

        return (
          <div key={step.number} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all",
                  isCompleted && "bg-primary text-primary-foreground",
                  isActive &&
                    "bg-primary text-primary-foreground ring-primary ring-2 ring-offset-2",
                  !isCompleted && !isActive && "bg-muted text-muted-foreground",
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : step.number}
              </div>
              <span
                className={cn(
                  "hidden text-xs sm:block",
                  isActive ? "text-foreground font-medium" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "mx-1 mb-5 h-px w-12 transition-colors sm:w-20",
                  currentStep > step.number ? "bg-primary" : "bg-muted",
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function FormField({
  label,
  error,
  required,
  children,
}: {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label className="mb-2 block text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  )
}

// Live "is this email free?" hint shown under the email inputs.
function EmailStatusHint({ status }: { status: EmailAvailability }) {
  if (status === "checking")
    return (
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking availability…
      </p>
    )
  if (status === "taken")
    return (
      <p className="text-destructive flex items-center gap-1.5 text-xs">
        <X className="h-3 w-3" />
        This email is already used by another employee
      </p>
    )
  if (status === "available")
    return (
      <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-500">
        <Check className="h-3 w-3" />
        Email is available
      </p>
    )
  return null
}

// ─── Review section ───────────────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-36 shrink-0 text-sm">{label}</span>
      <span className="text-sm font-medium">{value || "-"}</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EmployeeForm({ mode, employeeId }: EmployeeFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [currentStep, setCurrentStep] = useState(1)

  // Documents step state
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([])
  const [docsBusy, setDocsBusy] = useState(false)

  const { data: employeeData, isLoading: isLoadingEmployee } = useEmployee(
    mode === "edit" ? employeeId : null,
  )
  const { data: deptsData } = useDepartments()
  const { data: desigData } = useDesignations()
  const { data: codesData } = useEmployeeCodes()
  const employeeCodes = codesData?.data ?? []

  // Existing documents (edit mode only).
  const { data: existingDocsData, refetch: refetchDocs } = useQuery({
    queryKey: ["employee-documents", employeeId],
    queryFn: () => fetchEmployeeDocs(employeeId!),
    enabled: mode === "edit" && !!employeeId,
    staleTime: 30_000,
  })
  const existingDocs: ExistingDoc[] = existingDocsData?.data ?? []

  const departments = deptsData?.data ?? []
  const designations = desigData?.data ?? []

  const createEmployee = useCreateEmployee()
  const updateEmployee = useUpdateEmployee()

  // Add files chosen via the file picker as pending uploads.
  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const added: PendingDoc[] = []
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`"${file.name}" exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`)
        continue
      }
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        toast.error(`"${file.name}" is not an allowed file type`)
        continue
      }
      added.push({
        uid: crypto.randomUUID(),
        file,
        title: file.name.replace(/\.[^/.]+$/, ""),
        category: "OTHER",
      })
    }
    if (added.length > 0) setPendingDocs((prev) => [...prev, ...added])
  }

  function updatePendingDoc(uid: string, patch: Partial<Omit<PendingDoc, "uid" | "file">>) {
    setPendingDocs((prev) => prev.map((d) => (d.uid === uid ? { ...d, ...patch } : d)))
  }

  function removePendingDoc(uid: string) {
    setPendingDocs((prev) => prev.filter((d) => d.uid !== uid))
  }

  async function uploadPendingDocs(targetEmployeeId: string) {
    if (pendingDocs.length === 0) return
    setDocsBusy(true)
    let okCount = 0
    let failCount = 0
    for (const doc of pendingDocs) {
      const fd = new FormData()
      fd.append("file", doc.file)
      fd.append("title", doc.title.trim() || doc.file.name)
      fd.append("category", doc.category)
      if (doc.expiresAt) fd.append("expiresAt", doc.expiresAt)
      try {
        // Route Handler (not the Server Action) so files >1MB aren't rejected by
        // the default Server-Action body limit.
        const res = await fetch(`/api/employees/${targetEmployeeId}/documents`, {
          method: "POST",
          body: fd,
        })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error(json.error ?? "Upload failed")
        }
        okCount++
      } catch (err) {
        console.error("[employee-form] upload failed", doc.file.name, err)
        failCount++
      }
    }
    setDocsBusy(false)
    if (okCount > 0) toast.success(`Uploaded ${okCount} document${okCount !== 1 ? "s" : ""}`)
    if (failCount > 0)
      toast.error(`${failCount} document${failCount !== 1 ? "s" : ""} failed to upload`)
    setPendingDocs([])
  }

  async function deleteExistingDoc(docId: string) {
    if (!employeeId) return
    try {
      const r = await deleteEmployeeDocument(employeeId, docId)
      if (!r.ok) throw new Error(r.error)
      toast.success("Document removed")
      refetchDocs()
      queryClient.invalidateQueries({ queryKey: ["employee-documents", employeeId] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete")
    }
  }

  // Gmail App Password is optional: HR chooses to add one now or skip it. In edit
  // mode we default to "add" so the (leave-blank-to-keep) field stays visible.
  const [gmailMode, setGmailMode] = useState<"add" | "skip">(mode === "edit" ? "add" : "skip")

  // Login password (create only): always shown, pre-filled with a generated value.
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
    reset,
    trigger,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      gender: "",
      nationality: "Indian",
      employmentType: "FULL_TIME",
      onProbation: true,
      probationMonths: "6",
      sameAsCurrent: false,
      // Create mode: prefill a strong password and require change on first login.
      password: mode === "create" ? generatePassword() : "",
      mustChangePassword: mode === "create",
    },
  })

  const sameAsCurrent = watch("sameAsCurrent")
  const watchedValues = watch()

  // Real-time, debounced duplicate-email checks (skip the edited employee's own
  // record). Both fields are checked against work AND personal emails.
  const excludeForCheck = mode === "edit" ? employeeId : undefined
  const emailStatus = useEmailAvailability(watchedValues.email, excludeForCheck)
  const personalEmailStatus = useEmailAvailability(watchedValues.personalEmail, excludeForCheck)

  // On create, pre-fill the next free employee code once the existing codes load.
  // Runs once and never clobbers a value the user has already typed.
  const autoFilledCodeRef = useRef(false)
  useEffect(() => {
    if (mode !== "create" || autoFilledCodeRef.current || !codesData) return
    autoFilledCodeRef.current = true
    if (!watchedValues.employeeNo) {
      setValue("employeeNo", nextEmployeeCode(employeeCodes.map((e) => e.employeeNo)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codesData, mode, setValue])

  // Probation fields are editable only by Super Admin / Admin / HR Manager.
  const { isSuperAdmin, roles } = usePermissions()
  const isProbationAdmin = isSuperAdmin || roles.includes("admin") || roles.includes("hr_manager")

  // Live preview of when probation ends, from the joining date + selected period.
  const probationPreview = getProbationStatus({
    onProbation: watchedValues.onProbation ?? true,
    probationMonths: watchedValues.probationMonths ? Number(watchedValues.probationMonths) : 6,
    dateOfJoining: watchedValues.dateOfJoining || null,
  })
  const probationHint = !watchedValues.dateOfJoining
    ? "Set a date of joining first"
    : probationPreview.endDate
      ? `${formatDate(probationPreview.endDate.toISOString())}${
          probationPreview.onProbation
            ? ` · ${probationPreview.daysRemaining} day(s) left`
            : " · completed"
        }`
      : "-"

  // Populate form when editing
  useEffect(() => {
    if (mode === "edit" && employeeData?.data) {
      const emp = employeeData.data
      const ca = (emp.currentAddress ?? {}) as Record<string, string>
      const pa = (emp.permanentAddress ?? {}) as Record<string, string>
      const ec = (emp.emergencyContact ?? {}) as Record<string, string>

      reset({
        employeeNo: emp.employeeNo ?? "",
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        personalEmail: emp.personalEmail ?? "",
        phone: emp.phone ?? "",
        personalPhone: emp.personalPhone ?? "",
        dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.split("T")[0] : "",
        gender: (emp.gender as FormData["gender"]) ?? "",
        nationality: emp.nationality ?? "",
        bloodGroup: emp.bloodGroup ?? "",
        departmentId: emp.department?.id ?? "",
        designationId: emp.designation?.id ?? "",
        managerId: emp.manager?.id ?? "",
        employmentType: (emp.employmentType as FormData["employmentType"]) ?? "FULL_TIME",
        dateOfJoining: emp.dateOfJoining ? emp.dateOfJoining.split("T")[0] : "",
        probationEndDate: emp.probationEndDate ? emp.probationEndDate.split("T")[0] : "",
        onProbation: emp.onProbation ?? true,
        probationMonths: String(emp.probationMonths ?? 6) as FormData["probationMonths"],
        workLocation: emp.workLocation ?? "",
        deviceId: emp.deviceId ?? "",
        currentLine1: ca.line1 ?? "",
        currentLine2: ca.line2 ?? "",
        currentCity: ca.city ?? "",
        currentState: ca.state ?? "",
        currentZip: ca.zip ?? "",
        // Required boolean in the schema - must be present or handleSubmit() fails
        // validation silently (the checkbox lives on a later step, so no visible error).
        sameAsCurrent: false,
        permanentLine1: pa.line1 ?? "",
        permanentLine2: pa.line2 ?? "",
        permanentCity: pa.city ?? "",
        permanentState: pa.state ?? "",
        permanentZip: pa.zip ?? "",
        emergencyName: ec.name ?? "",
        emergencyRelation: ec.relation ?? "",
        emergencyPhone: ec.phone ?? "",
        // Never repopulated - API never returns the stored value. Blank = unchanged.
        gmailAppPassword: "",
      })
    }
  }, [employeeData, mode, reset])

  const stepFields: Record<number, (keyof FormData)[]> = {
    1: [
      "firstName",
      "lastName",
      "email",
      "personalEmail",
      "phone",
      "personalPhone",
      "dateOfBirth",
      "gender",
      "nationality",
    ],
    // Core employment fields are required; gmail format is checked here, and its
    // "required on create" rule is enforced in goNext() (only when "Add" is chosen).
    2: [
      "employeeNo",
      "departmentId",
      "designationId",
      "employmentType",
      "dateOfJoining",
      "workLocation",
      "gmailAppPassword",
      "password",
    ],
    3: [], // Documents step - no schema fields to validate (files only)
    4: [],
    5: [],
  }

  async function goNext() {
    const fieldsToValidate = stepFields[currentStep]
    const valid = fieldsToValidate.length > 0 ? await trigger(fieldsToValidate) : true

    // Don't leave step 1 while a duplicate email is flagged. The red EmailStatusHint
    // under the field already explains why; the server re-checks on submit too.
    if (currentStep === 1 && (emailStatus === "taken" || personalEmailStatus === "taken")) {
      return
    }

    // When the user chose to add an App Password on create, it's required here.
    // (Skip mode leaves it blank; edit mode treats blank as "leave unchanged".)
    if (currentStep === 2 && mode === "create" && gmailMode === "add") {
      const raw = (watchedValues.gmailAppPassword ?? "").replace(/\s+/g, "")
      if (raw === "") {
        setError("gmailAppPassword", {
          type: "required",
          message: "Gmail App Password is required",
        })
        return
      }
    }

    // Login password is always required on create (auto-filled, but HR may edit it).
    if (currentStep === 2 && mode === "create") {
      const pw = watchedValues.password ?? ""
      if (pw.length < 8) {
        setError("password", {
          type: "required",
          message: "Password must be at least 8 characters",
        })
        return
      }
    }

    // Address is required on create. The permanent address is only required when
    // it differs from the current one. (Edit mode leaves these optional - the
    // per-section edit modals handle editing later.)
    if (currentStep === 4 && mode === "create") {
      const requiredAddr: [keyof FormData, string][] = [
        ["currentLine1", "Address line 1 is required"],
        ["currentCity", "City is required"],
        ["currentState", "State is required"],
        ["currentZip", "ZIP / postal code is required"],
      ]
      if (!watchedValues.sameAsCurrent) {
        requiredAddr.push(
          ["permanentLine1", "Address line 1 is required"],
          ["permanentCity", "City is required"],
          ["permanentState", "State is required"],
          ["permanentZip", "ZIP / postal code is required"],
        )
      }
      let addrHasError = false
      for (const [field, message] of requiredAddr) {
        if (!String(watchedValues[field] ?? "").trim()) {
          setError(field, { type: "required", message })
          addrHasError = true
        } else {
          clearErrors(field)
        }
      }
      if (addrHasError) return
    }

    if (valid) setCurrentStep((s) => Math.min(s + 1, STEPS.length))
  }

  function goPrev() {
    setCurrentStep((s) => Math.max(s - 1, 1))
  }

  async function onSubmit(data: FormData) {
    // Only the final step may actually create/save. Guards against any stray
    // submit before review (e.g. Enter pressed in a field) - treat it as "Next".
    if (currentStep < STEPS.length) {
      await goNext()
      return
    }

    const payload = {
      employeeNo: data.employeeNo?.trim() || undefined,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      personalEmail: data.personalEmail || undefined,
      phone: data.phone || undefined,
      personalPhone: data.personalPhone || undefined,
      dateOfBirth: data.dateOfBirth || undefined,
      gender: data.gender || undefined,
      nationality: data.nationality || undefined,
      bloodGroup: data.bloodGroup || undefined,
      departmentId: data.departmentId || undefined,
      designationId: data.designationId || undefined,
      managerId: data.managerId || undefined,
      employmentType: data.employmentType,
      dateOfJoining: data.dateOfJoining || undefined,
      probationEndDate: data.probationEndDate || undefined,
      onProbation: data.onProbation ?? true,
      probationMonths: data.probationMonths ? Number(data.probationMonths) : undefined,
      workLocation: data.workLocation || undefined,
      deviceId: data.deviceId || undefined,
      currentAddress:
        data.currentLine1 || data.currentCity
          ? {
              line1: data.currentLine1,
              line2: data.currentLine2,
              city: data.currentCity,
              state: data.currentState,
              zip: data.currentZip,
            }
          : undefined,
      permanentAddress: data.sameAsCurrent
        ? {
            line1: data.currentLine1,
            line2: data.currentLine2,
            city: data.currentCity,
            state: data.currentState,
            zip: data.currentZip,
          }
        : data.permanentLine1 || data.permanentCity
          ? {
              line1: data.permanentLine1,
              line2: data.permanentLine2,
              city: data.permanentCity,
              state: data.permanentState,
              zip: data.permanentZip,
            }
          : undefined,
      emergencyContact: data.emergencyName
        ? {
            name: data.emergencyName,
            relation: data.emergencyRelation,
            phone: data.emergencyPhone,
          }
        : undefined,
      // Send only when the user typed something. Empty on edit = "leave unchanged".
      gmailAppPassword: data.gmailAppPassword?.replace(/\s+/g, "") || undefined,
      // Login password (create only). The form always supplies one (auto-filled),
      // so the server uses it instead of generating its own.
      password: mode === "create" ? data.password || undefined : undefined,
      mustChangePassword: mode === "create" ? (data.mustChangePassword ?? true) : undefined,
    }

    if (mode === "create") {
      const result = await createEmployee.mutateAsync(payload as Record<string, unknown>)
      const created = result?.data
      if (created?.id) {
        // Upload any staged documents before redirecting.
        if (pendingDocs.length > 0) await uploadPendingDocs(created.id)
        router.push(
          `/employees/${employeeSlug(created.employeeNo, created.firstName, created.lastName)}`,
        )
      }
    } else if (mode === "edit" && employeeId) {
      await updateEmployee.mutateAsync({ id: employeeId, body: payload as Record<string, unknown> })
      if (pendingDocs.length > 0) await uploadPendingDocs(employeeId)
      router.push(`/employees/${employeeSlug(data.employeeNo, data.firstName, data.lastName)}`)
    }
  }

  const isSubmitting = createEmployee.isPending || updateEmployee.isPending || docsBusy

  if (mode === "edit" && isLoadingEmployee) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    )
  }

  const selectedDept = departments.find((d) => d.id === watchedValues.departmentId)
  const selectedDesig = designations.find((d) => d.id === watchedValues.designationId)

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <StepIndicator steps={STEPS} currentStep={currentStep} />

      {/* ── Step 1: Personal Info ──────────────────────────────────────────── */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField label="First Name" required error={errors.firstName?.message}>
              <Input {...register("firstName")} placeholder="John" />
            </FormField>

            <FormField label="Last Name" required error={errors.lastName?.message}>
              <Input {...register("lastName")} placeholder="Doe" />
            </FormField>

            <FormField label="Work Email" required error={errors.email?.message}>
              <Input {...register("email")} type="email" placeholder="john.doe@company.com" />
              {!errors.email && <EmailStatusHint status={emailStatus} />}
            </FormField>

            <FormField label="Personal Email" required error={errors.personalEmail?.message}>
              <Input {...register("personalEmail")} type="email" placeholder="john@gmail.com" />
              {!errors.personalEmail && <EmailStatusHint status={personalEmailStatus} />}
            </FormField>

            <FormField label="Work Phone" required error={errors.phone?.message}>
              <Input {...register("phone")} placeholder="+91 98765 43210" />
            </FormField>

            <FormField label="Personal Phone" required error={errors.personalPhone?.message}>
              <Input {...register("personalPhone")} placeholder="+91 98765 43210" />
            </FormField>

            <FormField label="Date of Birth" required error={errors.dateOfBirth?.message}>
              <DateField
                value={watchedValues.dateOfBirth}
                onChange={(v) => setValue("dateOfBirth", v, { shouldValidate: true })}
                startMonth={new Date(1950, 0)}
                endMonth={new Date()}
                disabled={(date) => date > new Date()}
              />
            </FormField>

            <FormField label="Gender" required error={errors.gender?.message}>
              <Select
                // key forces a remount when the value resolves after reset() -
                // Radix Select won't reflect a controlled value that changes post-mount.
                key={`gender-${watchedValues.gender || "none"}`}
                value={watchedValues.gender || ""}
                onValueChange={(v) =>
                  setValue("gender", v as FormData["gender"], { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                  <SelectItem value="PREFER_NOT_TO_SAY">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Nationality" required error={errors.nationality?.message}>
              <Select
                key={`nat-${watchedValues.nationality || "none"}`}
                value={watchedValues.nationality || ""}
                onValueChange={(v) => setValue("nationality", v, { shouldValidate: true })}
              >
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
            </FormField>

            <FormField label="Blood Group" error={errors.bloodGroup?.message}>
              <Select
                key={`blood-${watchedValues.bloodGroup || "none"}`}
                value={watchedValues.bloodGroup || ""}
                onValueChange={(v) => setValue("bloodGroup", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select blood group" />
                </SelectTrigger>
                <SelectContent>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                    <SelectItem key={bg} value={bg}>
                      {bg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Employment ────────────────────────────────────────────── */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Employment Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Probation (admin only) - kept at the top of the step. */}
            {isProbationAdmin && (
              <div className="border-border bg-muted/30 space-y-3 rounded border p-4 sm:col-span-2">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label className="text-sm font-medium">On Probation</Label>
                    <p className="text-muted-foreground text-xs">
                      New hires start on probation. Turn off to confirm early. (Admin only)
                    </p>
                  </div>
                  <Switch
                    checked={watchedValues.onProbation ?? true}
                    onCheckedChange={(v) => setValue("onProbation", v)}
                  />
                </div>

                {(watchedValues.onProbation ?? true) && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField label="Probation Period" required>
                      <Select
                        key={`prob-${watchedValues.probationMonths ?? "6"}`}
                        value={watchedValues.probationMonths ?? "6"}
                        onValueChange={(v) =>
                          setValue("probationMonths", v as FormData["probationMonths"])
                        }
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
                    </FormField>

                    <FormField label="Probation Ends">
                      <div className="border-input bg-background text-muted-foreground flex h-10 items-center rounded border px-3 text-sm">
                        {probationHint}
                      </div>
                    </FormField>
                  </div>
                )}
              </div>
            )}

            <FormField label="Employee Code" required error={errors.employeeNo?.message}>
              <div className="flex gap-2">
                <Input
                  {...register("employeeNo")}
                  placeholder="e.g. 132"
                  autoComplete="off"
                  className="flex-1"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="h-10 shrink-0 gap-1.5 px-3">
                      <List className="h-4 w-4" />
                      View codes
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 p-0">
                    <div className="text-muted-foreground border-b px-3 py-2 text-xs font-medium">
                      Existing employee codes ({employeeCodes.length})
                    </div>
                    <div className="max-h-64 overflow-y-auto p-1">
                      {employeeCodes.length === 0 ? (
                        <p className="text-muted-foreground px-2 py-3 text-center text-sm">
                          No employees yet.
                        </p>
                      ) : (
                        employeeCodes.map((e) => (
                          <div
                            key={e.id}
                            className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm"
                          >
                            <span className="truncate">
                              {e.firstName} {e.lastName}
                            </span>
                            <span className="text-muted-foreground shrink-0 tabular-nums">
                              {e.employeeNo}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                Auto-filled to the next free code. Must be unique.
              </p>
            </FormField>

            <FormField label="Department" required error={errors.departmentId?.message}>
              <Select
                key={`dept-${watchedValues.departmentId || "none"}`}
                value={watchedValues.departmentId || ""}
                onValueChange={(v) => setValue("departmentId", v, { shouldValidate: true })}
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
            </FormField>

            <FormField label="Designation" required error={errors.designationId?.message}>
              <Select
                key={`desig-${watchedValues.designationId || "none"}`}
                value={watchedValues.designationId || ""}
                onValueChange={(v) => setValue("designationId", v, { shouldValidate: true })}
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
            </FormField>

            <FormField label="Employment Type" required error={errors.employmentType?.message}>
              <Select
                key={`emp-${watchedValues.employmentType || "none"}`}
                value={watchedValues.employmentType}
                onValueChange={(v) => setValue("employmentType", v as FormData["employmentType"])}
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
            </FormField>

            <FormField label="Manager" error={errors.managerId?.message}>
              <EmployeeCombobox
                value={watchedValues.managerId}
                onChange={(id) => setValue("managerId", id ?? "")}
                excludeId={mode === "edit" ? employeeId : undefined}
                initialLabel={
                  employeeData?.data?.manager
                    ? `${employeeData.data.manager.firstName} ${employeeData.data.manager.lastName}`
                    : undefined
                }
                placeholder="Search and select a manager"
              />
            </FormField>

            <FormField label="Date of Joining" required error={errors.dateOfJoining?.message}>
              <DateField
                value={watchedValues.dateOfJoining}
                onChange={(v) => setValue("dateOfJoining", v, { shouldValidate: true })}
                startMonth={new Date(2000, 0)}
                endMonth={new Date(new Date().getFullYear() + 1, 11)}
              />
            </FormField>

            <FormField label="Work Location" required error={errors.workLocation?.message}>
              <Select
                key={`loc-${watchedValues.workLocation || "none"}`}
                value={watchedValues.workLocation || ""}
                onValueChange={(v) => setValue("workLocation", v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select work location" />
                </SelectTrigger>
                <SelectContent>
                  {WORK_LOCATIONS.map((loc) => (
                    <SelectItem key={loc} value={loc}>
                      {loc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Biometric Device ID" error={errors.deviceId?.message}>
              <Input
                {...register("deviceId")}
                placeholder="Hikvision Employee ID (for attendance import)"
                autoComplete="off"
              />
            </FormField>

            {/* Login password (create only). Auto-filled with a generated value; HR
                can edit it or regenerate. It is emailed to the employee either way. */}
            {mode === "create" && (
              <div className="border-border bg-muted/30 space-y-3 rounded border p-4 sm:col-span-2">
                <FormField label="Login Password" required error={errors.password?.message}>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        {...register("password")}
                        type={showPassword ? "text" : "password"}
                        placeholder="At least 8 characters"
                        autoComplete="off"
                        className="pr-10 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 shrink-0 gap-1.5 px-3"
                      onClick={() => {
                        setShowPassword(true)
                        setValue("password", generatePassword(), { shouldValidate: true })
                      }}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Generate
                    </Button>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Auto-generated and emailed to the employee. Edit it or click Generate for a new
                    one.
                  </p>
                </FormField>

                <div className="flex items-center justify-between gap-4 border-t pt-3">
                  <div>
                    <Label className="mb-0 flex items-center gap-1.5 text-sm font-medium">
                      <KeyRound className="h-3.5 w-3.5" />
                      Require password change on first login
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      The employee must set their own password before they can use the app.
                    </p>
                  </div>
                  <Switch
                    checked={watchedValues.mustChangePassword ?? true}
                    onCheckedChange={(v) => setValue("mustChangePassword", v)}
                  />
                </div>
              </div>
            )}

            {/* Gmail App Password - encrypted at rest, used to send emails as this
                employee. HR toggles whether to add one now or skip it. */}
            <div className="border-border bg-muted/30 space-y-3 rounded border p-4 sm:col-span-2">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-sm font-medium">Gmail App Password</Label>
                  <p className="text-muted-foreground text-xs">
                    Add a Gmail App Password to send emails as this employee, or leave it off to
                    skip.
                  </p>
                </div>
                <Switch
                  checked={gmailMode === "add"}
                  onCheckedChange={(v) => {
                    setGmailMode(v ? "add" : "skip")
                    if (!v) setValue("gmailAppPassword", "")
                  }}
                />
              </div>

              {gmailMode === "add" && (
                <FormField
                  label={
                    mode === "edit" && employeeData?.data?.hasGmailAppPassword
                      ? "App Password (currently set - leave blank to keep)"
                      : "App Password"
                  }
                  required={mode === "create"}
                  error={errors.gmailAppPassword?.message}
                >
                  <Input
                    {...register("gmailAppPassword")}
                    type="password"
                    placeholder="abcd efgh ijkl mnop"
                    autoComplete="off"
                  />
                  <p className="text-muted-foreground mt-1 text-xs">
                    16-character App Password from{" "}
                    <a
                      href="https://myaccount.google.com/apppasswords"
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline"
                    >
                      myaccount.google.com → Security → App Passwords
                    </a>
                    . Stored encrypted (AES-256-GCM); never shown again after save.
                  </p>
                </FormField>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Documents ─────────────────────────────────────────────── */}
      {currentStep === 3 && (
        <div className="space-y-6">
          {/* Hidden file input shared by every "Add Document" trigger on this step. */}
          <input
            id="emp-doc-input"
            type="file"
            multiple
            className="hidden"
            accept={ALLOWED_FILE_TYPES.join(",")}
            onChange={(e) => {
              handleFiles(e.target.files)
              e.target.value = ""
            }}
          />

          {/* Existing documents (edit mode only) */}
          {mode === "edit" && existingDocs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Uploaded Documents</CardTitle>
                <p className="text-muted-foreground text-xs">
                  Documents already on file for this employee.
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {existingDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="bg-muted/30 hover:bg-muted/50 flex items-center justify-between rounded border px-4 py-3 transition-colors"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="bg-background flex h-9 w-9 shrink-0 items-center justify-center rounded border">
                        <FileText className="text-muted-foreground h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{doc.title}</p>
                        <p className="text-muted-foreground truncate text-xs">
                          {doc.fileName} · {(doc.fileSize / 1024).toFixed(1)} KB ·{" "}
                          {DOCUMENT_CATEGORY_LABELS[doc.category] ?? doc.category}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive h-8 w-8 shrink-0"
                      onClick={() => deleteExistingDoc(doc.id)}
                      aria-label="Remove document"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* New documents to upload */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-base">Upload Documents</CardTitle>
                <p className="text-muted-foreground mt-1 text-xs">
                  ID proof, certificates, offer letters, etc. PDF / DOC / JPG / PNG up to{" "}
                  {MAX_FILE_SIZE / (1024 * 1024)}MB each.
                </p>
              </div>
              {pendingDocs.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1.5"
                  onClick={() => document.getElementById("emp-doc-input")?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Add Document
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingDocs.length === 0 ? (
                <label
                  htmlFor="emp-doc-input"
                  className="border-border hover:border-foreground/40 hover:bg-muted/30 flex cursor-pointer flex-col items-center justify-center rounded border border-dashed py-12 transition-colors"
                >
                  <Upload className="text-muted-foreground mb-3 h-6 w-6" />
                  <span className="text-sm font-medium">Click to add documents</span>
                  <span className="text-muted-foreground mt-1 text-xs">
                    You can select multiple files
                  </span>
                </label>
              ) : (
                <div className="space-y-3">
                  {pendingDocs.map((doc) => (
                    <div key={doc.uid} className="bg-muted/20 space-y-4 rounded border p-4">
                      {/* Filename header - prominent so it's clear which doc you're editing */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="bg-background flex h-9 w-9 shrink-0 items-center justify-center rounded border">
                            <FileText className="text-muted-foreground h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{doc.file.name}</p>
                            <p className="text-muted-foreground text-xs">
                              {(doc.file.size / 1024).toFixed(1)} KB ·{" "}
                              {doc.file.type || "unknown type"}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0"
                          onClick={() => removePendingDoc(doc.uid)}
                          aria-label="Remove file"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Metadata grid */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <FormField label="Document Title" required>
                          <Input
                            value={doc.title}
                            onChange={(e) => updatePendingDoc(doc.uid, { title: e.target.value })}
                            placeholder="e.g. PAN Card"
                          />
                        </FormField>
                        <FormField label="Category">
                          <Select
                            value={doc.category}
                            onValueChange={(v) =>
                              updatePendingDoc(doc.uid, { category: v as DocCategory })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormField>
                        <FormField label="Expires (optional)">
                          <Input
                            type="date"
                            value={doc.expiresAt ?? ""}
                            onChange={(e) =>
                              updatePendingDoc(doc.uid, { expiresAt: e.target.value || undefined })
                            }
                          />
                        </FormField>
                      </div>
                    </div>
                  ))}

                  {/* Trailing "Add Another" button beneath the list */}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-1.5 border-dashed"
                    onClick={() => document.getElementById("emp-doc-input")?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Add Another Document
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Step 4: Address & Emergency ───────────────────────────────────── */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current Address</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FormField
                  label="Address Line 1"
                  required={mode === "create"}
                  error={errors.currentLine1?.message}
                >
                  <Input {...register("currentLine1")} placeholder="Street address, building" />
                </FormField>
              </div>
              <div className="sm:col-span-2">
                <FormField label="Address Line 2">
                  <Input {...register("currentLine2")} placeholder="Apartment, suite, unit" />
                </FormField>
              </div>
              <FormField
                label="City"
                required={mode === "create"}
                error={errors.currentCity?.message}
              >
                <Input {...register("currentCity")} placeholder="Mumbai" />
              </FormField>
              <FormField
                label="State"
                required={mode === "create"}
                error={errors.currentState?.message}
              >
                <Input {...register("currentState")} placeholder="Maharashtra" />
              </FormField>
              <FormField
                label="ZIP / Postal Code"
                required={mode === "create"}
                error={errors.currentZip?.message}
              >
                <Input {...register("currentZip")} placeholder="400001" />
              </FormField>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Permanent Address</CardTitle>
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={sameAsCurrent}
                    onCheckedChange={(checked) => setValue("sameAsCurrent", !!checked)}
                  />
                  <span className="text-muted-foreground text-sm">Same as current</span>
                </label>
              </div>
            </CardHeader>
            {!sameAsCurrent && (
              <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FormField
                    label="Address Line 1"
                    required={mode === "create"}
                    error={errors.permanentLine1?.message}
                  >
                    <Input {...register("permanentLine1")} placeholder="Street address, building" />
                  </FormField>
                </div>
                <div className="sm:col-span-2">
                  <FormField label="Address Line 2">
                    <Input {...register("permanentLine2")} placeholder="Apartment, suite, unit" />
                  </FormField>
                </div>
                <FormField
                  label="City"
                  required={mode === "create"}
                  error={errors.permanentCity?.message}
                >
                  <Input {...register("permanentCity")} placeholder="Pune" />
                </FormField>
                <FormField
                  label="State"
                  required={mode === "create"}
                  error={errors.permanentState?.message}
                >
                  <Input {...register("permanentState")} placeholder="Maharashtra" />
                </FormField>
                <FormField
                  label="ZIP / Postal Code"
                  required={mode === "create"}
                  error={errors.permanentZip?.message}
                >
                  <Input {...register("permanentZip")} placeholder="411001" />
                </FormField>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Emergency Contact</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FormField label="Contact Name">
                <Input {...register("emergencyName")} placeholder="Jane Doe" />
              </FormField>
              <FormField label="Relation">
                <Input {...register("emergencyRelation")} placeholder="Spouse, Parent, etc." />
              </FormField>
              <FormField label="Phone Number">
                <Input {...register("emergencyPhone")} placeholder="+91 98765 43210" />
              </FormField>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Step 5: Review ────────────────────────────────────────────────── */}
      {currentStep === 5 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <ReviewRow
                label="Full Name"
                value={`${watchedValues.firstName || ""} ${watchedValues.lastName || ""}`.trim()}
              />
              <ReviewRow label="Work Email" value={watchedValues.email} />
              <ReviewRow label="Personal Email" value={watchedValues.personalEmail} />
              <ReviewRow label="Work Phone" value={watchedValues.phone} />
              <ReviewRow label="Personal Phone" value={watchedValues.personalPhone} />
              <ReviewRow
                label="Date of Birth"
                value={
                  watchedValues.dateOfBirth ? formatDate(watchedValues.dateOfBirth) : undefined
                }
              />
              <ReviewRow label="Gender" value={watchedValues.gender || undefined} />
              <ReviewRow label="Nationality" value={watchedValues.nationality} />
              <ReviewRow label="Blood Group" value={watchedValues.bloodGroup} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Employment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <ReviewRow
                label="Employee Code"
                value={
                  watchedValues.employeeNo?.trim() ||
                  (mode === "create" ? "Auto-generate" : undefined)
                }
              />
              <ReviewRow label="Department" value={selectedDept?.name} />
              <ReviewRow label="Designation" value={selectedDesig?.title} />
              <ReviewRow
                label="Employment Type"
                value={
                  EMPLOYMENT_TYPE_LABELS[watchedValues.employmentType] ??
                  watchedValues.employmentType
                }
              />
              <ReviewRow label="Work Location" value={watchedValues.workLocation} />
              <ReviewRow
                label="Date of Joining"
                value={
                  watchedValues.dateOfJoining ? formatDate(watchedValues.dateOfJoining) : undefined
                }
              />
              <ReviewRow
                label="Probation"
                value={
                  (watchedValues.onProbation ?? true)
                    ? `On probation (${watchedValues.probationMonths ?? "6"} months)${
                        probationPreview.endDate
                          ? ` · ends ${formatDate(probationPreview.endDate.toISOString())}`
                          : ""
                      }`
                    : "Confirmed (not on probation)"
                }
              />
              {mode === "create" && (
                <>
                  <ReviewRow label="Login Password" value="Set · emailed to employee" />
                  <ReviewRow
                    label="First Login"
                    value={
                      (watchedValues.mustChangePassword ?? true)
                        ? "Must change password"
                        : "No change required"
                    }
                  />
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {watchedValues.currentLine1 && (
                <ReviewRow
                  label="Current Address"
                  value={[
                    watchedValues.currentLine1,
                    watchedValues.currentLine2,
                    watchedValues.currentCity,
                    watchedValues.currentState,
                    watchedValues.currentZip,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                />
              )}
              {sameAsCurrent ? (
                <ReviewRow label="Permanent Address" value="Same as current" />
              ) : watchedValues.permanentLine1 ? (
                <ReviewRow
                  label="Permanent Address"
                  value={[
                    watchedValues.permanentLine1,
                    watchedValues.permanentLine2,
                    watchedValues.permanentCity,
                    watchedValues.permanentState,
                    watchedValues.permanentZip,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                />
              ) : null}
            </CardContent>
          </Card>

          {watchedValues.emergencyName && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Emergency Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <ReviewRow label="Name" value={watchedValues.emergencyName} />
                <ReviewRow label="Relation" value={watchedValues.emergencyRelation} />
                <ReviewRow label="Phone" value={watchedValues.emergencyPhone} />
              </CardContent>
            </Card>
          )}

          {(pendingDocs.length > 0 || (mode === "edit" && existingDocs.length > 0)) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Documents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {mode === "edit" && existingDocs.length > 0 && (
                  <ReviewRow
                    label="Already uploaded"
                    value={`${existingDocs.length} document${existingDocs.length !== 1 ? "s" : ""}`}
                  />
                )}
                {pendingDocs.length > 0 && (
                  <ReviewRow
                    label="Will upload"
                    value={`${pendingDocs.length} new document${pendingDocs.length !== 1 ? "s" : ""}`}
                  />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <div className="mt-8 flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={goPrev}
          disabled={currentStep === 1}
          className="gap-1.5"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>

        <div className="flex items-center gap-3">
          {currentStep < STEPS.length ? (
            // Distinct `key` from the submit button below: without it React reuses
            // the same <button> DOM node and merely flips its `type` from "button"
            // to "submit" when goNext() advances to the last step. The flip happens
            // *during* the click event, so the browser's default action then sees
            // type="submit" and submits the form - auto-saving without a second
            // click. Separate keys force a fresh node, so the click can't submit.
            <Button key="nav-next" type="button" onClick={goNext} className="gap-1.5">
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              key="nav-submit"
              type="submit"
              disabled={isSubmitting}
              className="min-w-[140px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : mode === "create" ? (
                "Create Employee"
              ) : (
                "Save Changes"
              )}
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
