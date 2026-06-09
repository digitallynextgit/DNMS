"use client"

import { useEffect, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Plus, Loader2, Briefcase, Users, ExternalLink, Sparkles } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { usePermissions } from "@/hooks/use-permissions"
import { PERMISSIONS, JOB_STATUS_LABELS, JOB_STATUS_COLORS } from "@/lib/constants"
import { cn, formatDate } from "@/lib/utils"
import { getDepartments, updateDepartment } from "@/lib/actions/departments"

interface Department {
  id: string
  name: string
  careersTone?: "red" | "teal" | null
  careersJobsLabel?: string | null
}
interface JobPosting {
  id: string
  title: string
  status: string
  location: string | null
  type: string
  closingDate: string | null
  createdAt: string
  department: { name: string } | null
  _count: { applicants: number }
}

async function fetchJobs(status?: string): Promise<{ data: JobPosting[] }> {
  const url = status ? `/api/recruitment/jobs?status=${status}` : "/api/recruitment/jobs"
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed")
  return res.json()
}

async function fetchDepts(): Promise<{ data: Department[] }> {
  const r = await getDepartments()
  if (!r.ok) throw new Error(r.error)
  return { data: r.data as Department[] }
}

async function createJob(body: Record<string, unknown>) {
  const res = await fetch("/api/recruitment/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed")
  return res.json()
}

const JOB_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP", "FREELANCE"]
const JOB_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
  FREELANCE: "Freelance",
}

const emptyForm = {
  title: "",
  departmentId: "",
  location: "",
  type: "FULL_TIME",
  salaryMin: "",
  salaryMax: "",
  closingDate: "",
  status: "OPEN",
  description: "",
  meta: "",
  summary: "",
  intro: "",
  jobEssence: "",
  keyRequirements: "",
  currentOpenings: "",
  publishToCareers: false,
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export default function RecruitmentPage() {
  const { can } = usePermissions()
  const canWrite = can(PERMISSIONS.RECRUITMENT_WRITE)
  const qc = useQueryClient()

  const [statusFilter, setStatusFilter] = useState<string>("")
  const { data: jobsData, isLoading } = useQuery({
    queryKey: ["jobs", statusFilter],
    queryFn: () => fetchJobs(statusFilter || undefined),
  })
  const { data: deptsData } = useQuery({ queryKey: ["departments"], queryFn: fetchDepts })
  const jobs = jobsData?.data ?? []
  const depts = deptsData?.data ?? []

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const createMut = useMutation({
    mutationFn: createJob,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] })
      toast.success("Job posting created")
      setOpen(false)
      setForm(emptyForm)
    },
    onError: () => toast.error("Failed to create job posting"),
  })

  const jobActionMut = useMutation({
    mutationFn: async ({
      id,
      action,
      status,
    }: {
      id: string
      action: "toggle" | "delete"
      status?: string
    }) => {
      if (action === "delete") {
        const res = await fetch(`/api/recruitment/jobs/${id}`, { method: "DELETE" })
        if (!res.ok) throw new Error("Failed to delete")
      } else {
        const res = await fetch(`/api/recruitment/jobs/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: status === "OPEN" ? "CLOSED" : "OPEN" }),
        })
        if (!res.ok) throw new Error("Failed to update")
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] })
      toast.success("Job posting updated")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const selectedDept = depts.find((d) => d.id === form.departmentId)
  const [deptTone, setDeptTone] = useState<"red" | "teal" | "">("")
  const [deptJobsLabel, setDeptJobsLabel] = useState("")
  const [deptSaving, setDeptSaving] = useState(false)

  useEffect(() => {
    setDeptTone(selectedDept?.careersTone ?? "")
    setDeptJobsLabel(selectedDept?.careersJobsLabel ?? "")
  }, [selectedDept?.id, selectedDept?.careersTone, selectedDept?.careersJobsLabel])

  const [aiGenerating, setAiGenerating] = useState(false)

  const generateWithAI = async () => {
    if (!form.title.trim()) {
      toast.error("Enter a job title first")
      return
    }
    setAiGenerating(true)
    try {
      const res = await fetch("/api/recruitment/jobs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          departmentName: selectedDept?.name,
          type: form.type,
          location: form.location,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? "AI request failed")
      }
      const { data } = (await res.json()) as {
        data: {
          meta?: string
          summary?: string
          intro?: string
          jobEssence?: string
          keyRequirements?: string[]
          currentOpenings?: string[]
        }
      }

      // Only fill empty fields - never overwrite the user's input.
      setForm((f) => ({
        ...f,
        meta: f.meta.trim() ? f.meta : (data.meta ?? ""),
        summary: f.summary.trim() ? f.summary : (data.summary ?? ""),
        intro: f.intro.trim() ? f.intro : (data.intro ?? ""),
        jobEssence: f.jobEssence.trim() ? f.jobEssence : (data.jobEssence ?? ""),
        keyRequirements: f.keyRequirements.trim()
          ? f.keyRequirements
          : (data.keyRequirements ?? []).join("\n"),
        currentOpenings: f.currentOpenings.trim()
          ? f.currentOpenings
          : (data.currentOpenings ?? []).join("\n"),
        publishToCareers: f.publishToCareers || Boolean(data.intro),
      }))
      toast.success("Filled empty fields with AI suggestions")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI request failed")
    } finally {
      setAiGenerating(false)
    }
  }

  const saveDeptSettings = async () => {
    if (!selectedDept) return
    setDeptSaving(true)
    try {
      const r = await updateDepartment(selectedDept.id, {
        careersTone: deptTone || null,
        careersJobsLabel: deptJobsLabel || null,
      })
      if (!r.ok) throw new Error(r.error)
      await qc.invalidateQueries({ queryKey: ["departments"] })
      toast.success("Department careers settings saved")
    } catch {
      toast.error("Failed to save department settings")
    } finally {
      setDeptSaving(false)
    }
  }

  const totalApplicants = jobs.reduce((sum, j) => sum + j._count.applicants, 0)
  const openJobs = jobs.filter((j) => j.status === "OPEN").length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recruitment"
        description="Manage job postings and applicant pipeline"
        actions={
          canWrite ? (
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> New Job
            </Button>
          ) : undefined
        }
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-blue-500/10">
              <Briefcase className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{jobs.length}</p>
              <p className="text-muted-foreground text-xs">Total Postings</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-green-500/10">
              <Briefcase className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{openJobs}</p>
              <p className="text-muted-foreground text-xs">Open Positions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-purple-500/10">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalApplicants}</p>
              <p className="text-muted-foreground text-xs">Total Applicants</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {["", "OPEN", "DRAFT", "ON_HOLD", "CLOSED"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              statusFilter === s
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {s === "" ? "All" : JOB_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-card flex flex-col items-center justify-center rounded border py-20 text-center">
          <Briefcase className="text-muted-foreground/40 mb-3 h-10 w-10" />
          <p className="text-muted-foreground text-sm">
            No job postings yet. Create your first one.
          </p>
          {canWrite && (
            <Button onClick={() => setOpen(true)} variant="outline" size="sm" className="mt-4">
              New Job Posting
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <Card key={job.id} className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm leading-snug">{job.title}</CardTitle>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      JOB_STATUS_COLORS[job.status],
                    )}
                  >
                    {JOB_STATUS_LABELS[job.status]}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {job.department?.name ?? "No Department"} · {JOB_TYPE_LABELS[job.type]}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <Users className="h-3.5 w-3.5" />
                    <span>
                      {job._count.applicants} applicant{job._count.applicants !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {job.location && (
                    <span className="text-muted-foreground text-xs">{job.location}</span>
                  )}
                </div>
                {job.closingDate && (
                  <p className="text-muted-foreground text-xs">
                    Closes {formatDate(job.closingDate)}
                  </p>
                )}
                <Link href={`/recruitment/jobs/${job.id}`}>
                  <Button variant="outline" size="sm" className="h-7 w-full gap-2 text-xs">
                    <ExternalLink className="h-3.5 w-3.5" /> View Pipeline
                  </Button>
                </Link>
                {canWrite && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 flex-1 text-xs"
                      disabled={jobActionMut.isPending}
                      onClick={() =>
                        jobActionMut.mutate({ id: job.id, action: "toggle", status: job.status })
                      }
                    >
                      {job.status === "OPEN" ? "Close" : "Reopen"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 h-7 px-2 text-xs"
                      disabled={jobActionMut.isPending}
                      onClick={() => {
                        if (confirm(`Delete job "${job.title}"? This removes its applicants too.`))
                          jobActionMut.mutate({ id: job.id, action: "delete" })
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Job Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Job Posting</DialogTitle>
          </DialogHeader>
          <div className="-mx-6 max-h-[70vh] space-y-3 overflow-y-auto px-6">
            <div className="space-y-1.5">
              <Label>Job Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Senior Software Engineer"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Select
                  value={form.departmentId}
                  onValueChange={(v) => setForm((f) => ({ ...f, departmentId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {depts.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {JOB_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedDept && (
              <div className="bg-muted/30 space-y-2.5 rounded border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">
                    Careers settings for &ldquo;{selectedDept.name}&rdquo;
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={saveDeptSettings}
                    disabled={deptSaving}
                  >
                    {deptSaving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />} Save
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tone</Label>
                    <Select
                      value={deptTone || "default"}
                      onValueChange={(v) =>
                        setDeptTone(v === "default" ? "" : (v as "red" | "teal"))
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default (teal)</SelectItem>
                        <SelectItem value="teal">Teal</SelectItem>
                        <SelectItem value="red">Red</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Jobs label</Label>
                    <Input
                      className="h-8 text-sm"
                      value={deptJobsLabel}
                      onChange={(e) => setDeptJobsLabel(e.target.value)}
                      placeholder="Explore Open Roles"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Mumbai, Remote"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Min Salary (optional)</Label>
                <Input
                  type="number"
                  value={form.salaryMin}
                  onChange={(e) => setForm((f) => ({ ...f, salaryMin: e.target.value }))}
                  placeholder="500000"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Max Salary (optional)</Label>
                <Input
                  type="number"
                  value={form.salaryMax}
                  onChange={(e) => setForm((f) => ({ ...f, salaryMax: e.target.value }))}
                  placeholder="1200000"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Closing Date</Label>
                <Input
                  type="date"
                  value={form.closingDate}
                  onChange={(e) => setForm((f) => ({ ...f, closingDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="OPEN">Open</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <textarea
                className="bg-background focus:ring-ring min-h-20 w-full resize-none rounded border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Job description, requirements..."
              />
            </div>

            <div className="space-y-3 rounded border border-dashed p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Publish to Careers Site</p>
                  <p className="text-muted-foreground text-xs">
                    Show this posting on the public careers page. Fill the title first, then use
                    <span className="font-medium"> Auto-fill</span> to draft the rest.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={generateWithAI}
                    disabled={aiGenerating || !form.title.trim()}
                    title={
                      !form.title.trim()
                        ? "Enter a job title first"
                        : "Generate copy from the title with AI"
                    }
                  >
                    {aiGenerating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    Auto-fill
                  </Button>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={form.publishToCareers}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, publishToCareers: e.target.checked }))
                      }
                    />
                    <span>Publish</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Meta (optional)</Label>
                  <Input
                    value={form.meta}
                    onChange={(e) => setForm((f) => ({ ...f, meta: e.target.value }))}
                    placeholder="e.g. Mumbai · 3–5 yrs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Summary (optional)</Label>
                  <Input
                    value={form.summary}
                    onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                    placeholder="One-line pitch"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Intro</Label>
                <textarea
                  className="bg-background focus:ring-ring min-h-20 w-full resize-none rounded border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
                  value={form.intro}
                  onChange={(e) => setForm((f) => ({ ...f, intro: e.target.value }))}
                  placeholder="Opening paragraph shown on the careers detail page."
                />
              </div>

              <div className="space-y-1.5">
                <Label>Job Essence (optional)</Label>
                <textarea
                  className="bg-background focus:ring-ring min-h-17.5 w-full resize-none rounded border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
                  value={form.jobEssence}
                  onChange={(e) => setForm((f) => ({ ...f, jobEssence: e.target.value }))}
                  placeholder="The gist - what success in this role looks like."
                />
              </div>

              <div className="space-y-1.5">
                <Label>Key Requirements (one per line)</Label>
                <textarea
                  className="bg-background focus:ring-ring min-h-22.5 w-full resize-none rounded border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
                  value={form.keyRequirements}
                  onChange={(e) => setForm((f) => ({ ...f, keyRequirements: e.target.value }))}
                  placeholder={
                    "3–5 years of experience\nStrong communication skills\nFamiliarity with AI tools"
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>Current Openings (one per line, optional)</Label>
                <textarea
                  className="bg-background focus:ring-ring min-h-17.5 w-full resize-none rounded border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
                  value={form.currentOpenings}
                  onChange={(e) => setForm((f) => ({ ...f, currentOpenings: e.target.value }))}
                  placeholder={"Junior (1-2 Years)\nSenior (3-5 Years)\nLead"}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                createMut.mutate({
                  ...form,
                  keyRequirements: splitLines(form.keyRequirements),
                  currentOpenings: splitLines(form.currentOpenings),
                })
              }
              disabled={createMut.isPending || !form.title}
            >
              {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
