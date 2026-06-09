"use client"

import { useState, useRef } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Plus,
  Loader2,
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  FileText,
  GripVertical,
  User,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Interview {
  id: string
  type: string
  scheduledAt: string
  result: string
  feedback: string | null
}

interface Applicant {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  stage: string
  appliedAt: string
  notes: string | null
  resumeUrl: string | null
  source: string | null
  interviews: Interview[]
}

interface Job {
  id: string
  title: string
  status: string
  location: string | null
  type: string
  description: string | null
  closingDate: string | null
  department: { name: string } | null
  postedBy: { firstName: string; lastName: string } | null
  applicants: Applicant[]
}

const STAGES = ["APPLIED", "SCREENING", "INTERVIEW", "OFFER", "HIRED", "REJECTED"]
const INTERVIEW_TYPES = ["PHONE", "VIDEO", "IN_PERSON", "TECHNICAL", "HR"]

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  APPLIED: {
    label: "Applied",
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800",
    dot: "bg-blue-500",
  },
  SCREENING: {
    label: "Screening",
    color: "text-yellow-700 dark:text-yellow-400",
    bg: "bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-800",
    dot: "bg-yellow-500",
  },
  INTERVIEW: {
    label: "Interview",
    color: "text-purple-700 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800",
    dot: "bg-purple-500",
  },
  OFFER: {
    label: "Offer",
    color: "text-orange-700 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800",
    dot: "bg-orange-500",
  },
  HIRED: {
    label: "Hired",
    color: "text-green-700 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800",
    dot: "bg-green-500",
  },
  REJECTED: {
    label: "Rejected",
    color: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800",
    dot: "bg-red-500",
  },
}

async function fetchJob(id: string): Promise<{ data: Job }> {
  const res = await fetch(`/api/recruitment/jobs/${id}`)
  if (!res.ok) throw new Error("Failed")
  return res.json()
}

async function updateApplicant(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/recruitment/applicants/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed")
  return res.json()
}

async function createApplicant(body: Record<string, unknown>) {
  const res = await fetch("/api/recruitment/applicants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed")
  return res.json()
}

async function scheduleInterview(body: Record<string, unknown>) {
  const res = await fetch("/api/recruitment/interviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed")
  return res.json()
}

const emptyApplicantForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  source: "",
  resumeUrl: "",
  notes: "",
}
const emptyInterviewForm = { type: "PHONE", scheduledAt: "", notes: "" }

function getInitials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

function ApplicantCard({
  applicant,
  onDragStart,
  onScheduleInterview,
}: {
  applicant: Applicant
  onDragStart: (e: React.DragEvent, id: string) => void
  onScheduleInterview: (applicant: Applicant) => void
}) {
  const latestInterview = applicant.interviews?.[applicant.interviews.length - 1]

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, applicant.id)}
      className="bg-card group cursor-grab rounded border p-3 shadow-sm transition-all duration-150 select-none hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start gap-2.5">
        <div className="bg-primary/10 text-primary flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold">
          {getInitials(applicant.firstName, applicant.lastName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <p className="truncate text-sm leading-tight font-medium">
              {applicant.firstName} {applicant.lastName}
            </p>
            <GripVertical className="text-muted-foreground/40 group-hover:text-muted-foreground/70 h-3.5 w-3.5 flex-shrink-0 transition-colors" />
          </div>

          {applicant.source && (
            <p className="text-muted-foreground mt-0.5 text-[10px]">{applicant.source}</p>
          )}
        </div>
      </div>

      <div className="mt-2.5 space-y-1">
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Mail className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{applicant.email}</span>
        </div>
        {applicant.phone && (
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Phone className="h-3 w-3 flex-shrink-0" />
            <span>{applicant.phone}</span>
          </div>
        )}
        {applicant.resumeUrl && (
          <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
            <FileText className="h-3 w-3 flex-shrink-0" />
            <a
              href={applicant.resumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View Resume
            </a>
          </div>
        )}
      </div>

      {latestInterview && (
        <div className="text-muted-foreground mt-2 flex items-center gap-1.5 border-t pt-2 text-xs">
          <Calendar className="h-3 w-3 flex-shrink-0" />
          <span>
            {latestInterview.type.charAt(0) + latestInterview.type.slice(1).toLowerCase()} ·{" "}
            <span
              className={cn(
                latestInterview.result === "PASSED" && "text-green-600 dark:text-green-400",
                latestInterview.result === "FAILED" && "text-red-600 dark:text-red-400",
                latestInterview.result === "PENDING" && "text-yellow-600 dark:text-yellow-400",
              )}
            >
              {latestInterview.result.charAt(0) + latestInterview.result.slice(1).toLowerCase()}
            </span>
          </span>
        </div>
      )}

      <button
        onClick={() => onScheduleInterview(applicant)}
        className="border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary mt-2.5 w-full rounded border border-dashed py-1.5 text-center text-xs transition-colors"
      >
        + Schedule Interview
      </button>
    </div>
  )
}

export default function JobPipelinePage() {
  const params = useParams<{ id: string }>()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["job", params.id],
    queryFn: () => fetchJob(params.id),
  })
  const job = data?.data

  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(emptyApplicantForm)
  const [interviewOpen, setInterviewOpen] = useState(false)
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null)
  const [iForm, setIForm] = useState(emptyInterviewForm)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const dragApplicantId = useRef<string | null>(null)

  const addMut = useMutation({
    mutationFn: createApplicant,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job", params.id] })
      toast.success("Applicant added")
      setAddOpen(false)
      setForm(emptyApplicantForm)
    },
    onError: () => toast.error("Failed to add applicant"),
  })

  const stageMut = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => updateApplicant(id, { stage }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job", params.id] })
      toast.success("Stage updated")
    },
    onError: () => toast.error("Failed to update stage"),
  })

  const interviewMut = useMutation({
    mutationFn: scheduleInterview,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job", params.id] })
      toast.success("Interview scheduled")
      setInterviewOpen(false)
      setIForm(emptyInterviewForm)
    },
    onError: () => toast.error("Failed to schedule interview"),
  })

  const handleDragStart = (e: React.DragEvent, id: string) => {
    dragApplicantId.current = id
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, stage: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverStage(stage)
  }

  const handleDrop = (e: React.DragEvent, targetStage: string) => {
    e.preventDefault()
    setDragOverStage(null)
    const id = dragApplicantId.current
    if (!id) return
    const applicant = job?.applicants.find((a) => a.id === id)
    if (!applicant || applicant.stage === targetStage) return
    stageMut.mutate({ id, stage: targetStage })
    dragApplicantId.current = null
  }

  if (isLoading)
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="flex gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-96 w-64 rounded" />
          ))}
        </div>
      </div>
    )

  if (!job) return null

  const grouped = STAGES.reduce(
    (acc, s) => ({
      ...acc,
      [s]: (job.applicants ?? []).filter((a) => a.stage === s),
    }),
    {} as Record<string, Applicant[]>,
  )

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="bg-background flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/recruitment">
            <Button variant="ghost" size="sm" className="h-8 gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold">{job.title}</h1>
            <p className="text-muted-foreground text-sm">
              {job.department?.name ?? "No department"} · {job.location ?? "Remote"} ·{" "}
              <span className="font-medium">
                {job.applicants?.length ?? 0} applicant{job.applicants?.length !== 1 ? "s" : ""}
              </span>
            </p>
          </div>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Applicant
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-max gap-4 p-6">
          {STAGES.map((stage) => {
            const cfg = STAGE_CONFIG[stage]
            const cards = grouped[stage] ?? []
            const isOver = dragOverStage === stage

            return (
              <div
                key={stage}
                className="flex w-72 shrink-0 flex-col"
                onDragOver={(e) => handleDragOver(e, stage)}
                onDrop={(e) => handleDrop(e, stage)}
                onDragLeave={() => setDragOverStage(null)}
              >
                {/* Column header */}
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 flex-shrink-0 rounded-full", cfg.dot)} />
                    <span className={cn("text-sm font-semibold", cfg.color)}>{cfg.label}</span>
                  </div>
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs font-medium">
                    {cards.length}
                  </Badge>
                </div>

                {/* Drop zone */}
                <div
                  className={cn(
                    "min-h-[200px] flex-1 rounded border-2 border-dashed p-2 transition-all duration-150",
                    isOver
                      ? "border-primary bg-primary/5 scale-[1.01]"
                      : "bg-muted/40 border-transparent",
                  )}
                >
                  <div className="space-y-2">
                    {cards.map((applicant) => (
                      <ApplicantCard
                        key={applicant.id}
                        applicant={applicant}
                        onDragStart={handleDragStart}
                        onScheduleInterview={(a) => {
                          setSelectedApplicant(a)
                          setIForm(emptyInterviewForm)
                          setInterviewOpen(true)
                        }}
                      />
                    ))}
                  </div>

                  {cards.length === 0 && (
                    <div
                      className={cn(
                        "flex h-24 flex-col items-center justify-center gap-1.5 rounded border border-dashed",
                        isOver ? "border-primary/50 bg-primary/5" : "border-muted-foreground/20",
                      )}
                    >
                      <User className="text-muted-foreground/40 h-4 w-4" />
                      <p className="text-muted-foreground/50 text-xs">Drop here</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Add Applicant Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Applicant</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone (optional)</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Source (optional)</Label>
                <Input
                  value={form.source}
                  onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                  placeholder="LinkedIn, Referral..."
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Resume URL (optional)</Label>
              <Input
                value={form.resumeUrl}
                onChange={(e) => setForm((f) => ({ ...f, resumeUrl: e.target.value }))}
                placeholder="https://drive.google.com/..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <textarea
                className="bg-background focus:ring-ring min-h-[60px] w-full resize-none rounded border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addMut.mutate({ ...form, jobId: job.id })}
              disabled={addMut.isPending || !form.firstName || !form.email}
            >
              {addMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Applicant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Interview Dialog */}
      {selectedApplicant && (
        <Dialog open={interviewOpen} onOpenChange={setInterviewOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Schedule Interview - {selectedApplicant.firstName} {selectedApplicant.lastName}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select
                    value={iForm.type}
                    onValueChange={(v) => setIForm((f) => ({ ...f, type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERVIEW_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t.charAt(0) + t.slice(1).toLowerCase().replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Date & Time</Label>
                  <Input
                    type="datetime-local"
                    value={iForm.scheduledAt}
                    onChange={(e) => setIForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notes (optional)</Label>
                <textarea
                  className="bg-background focus:ring-ring min-h-[60px] w-full resize-none rounded border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
                  value={iForm.notes}
                  onChange={(e) => setIForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInterviewOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => interviewMut.mutate({ ...iForm, applicantId: selectedApplicant.id })}
                disabled={interviewMut.isPending || !iForm.scheduledAt}
              >
                {interviewMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
