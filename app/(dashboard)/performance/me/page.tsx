"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Star, Loader2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { REVIEW_STATUS_LABELS, REVIEW_STATUS_COLORS } from "@/lib/constants"
import { StatusBadge } from "@/components/shared/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { cn } from "@/lib/utils"

interface Review {
  id: string
  status: string
  selfRating: number | null
  selfComments: string | null
  achievements: string | null
  improvements: string | null
  managerRating: number | null
  managerComments: string | null
  finalRating: number | null
  submittedAt: string | null
  completedAt: string | null
  cycle: { name: string; year: number; startDate: string; endDate: string }
  reviewer: { firstName: string; lastName: string } | null
}

async function fetchMyReviews(): Promise<{ data: Review[] }> {
  const res = await fetch("/api/performance/reviews?mine=true")
  if (!res.ok) throw new Error("Failed")
  return res.json()
}

async function submitSelfReview(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/performance/reviews/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Failed")
  return res.json()
}

function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          className="focus:outline-none"
        >
          <Star
            className={cn(
              "h-7 w-7 transition-colors",
              i <= (hover || value)
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/30 hover:text-amber-300",
            )}
          />
        </button>
      ))}
      {value > 0 && <span className="text-muted-foreground ml-1 text-sm">{value}/5</span>}
    </div>
  )
}

function RatingStars({ value }: { value: number | null }) {
  if (!value) return <span className="text-muted-foreground text-xs">-</span>
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30",
          )}
        />
      ))}
      <span className="text-muted-foreground ml-1 text-xs">{value}/5</span>
    </div>
  )
}

export default function MyReviewsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ["my-reviews"], queryFn: fetchMyReviews })
  const reviews = data?.data ?? []

  const [selectedId, setSelectedId] = useState<string>("")
  const review = reviews.find((r) => r.id === selectedId) ?? reviews[0]

  const [form, setForm] = useState({
    selfRating: 0,
    selfComments: "",
    achievements: "",
    improvements: "",
  })

  const submitMut = useMutation({
    mutationFn: (id: string) => submitSelfReview(id, { ...form, status: "SELF_REVIEW" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-reviews"] })
      toast.success("Self-review submitted")
    },
    onError: () => toast.error("Failed to submit review"),
  })

  const saveDraftMut = useMutation({
    mutationFn: (id: string) =>
      submitSelfReview(id, {
        selfRating: form.selfRating || undefined,
        selfComments: form.selfComments,
        achievements: form.achievements,
        improvements: form.improvements,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-reviews"] })
      toast.success("Draft saved")
    },
    onError: () => toast.error("Failed to save draft"),
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My Reviews"
          description="View and submit your performance self-assessment"
        />
        <ListSkeleton rows={3} height="h-32" />
      </div>
    )
  }

  if (reviews.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My Reviews"
          description="View and submit your performance self-assessment"
        />
        <EmptyState icon={Star} variant="card" title="No performance reviews assigned yet." />
      </div>
    )
  }

  const isSelfReview = review?.status === "SELF_REVIEW"
  const isCompleted = review?.status === "COMPLETED"

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Reviews"
        description="View and submit your performance self-assessment"
      />

      {reviews.length > 1 && (
        <Select value={review?.id ?? ""} onValueChange={setSelectedId}>
          <SelectTrigger className="h-8 w-72 text-sm">
            <SelectValue placeholder="Select review cycle" />
          </SelectTrigger>
          <SelectContent>
            {reviews.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.cycle.name} ({r.cycle.year})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {review && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left - Review form */}
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{review.cycle.name}</CardTitle>
                  <StatusBadge
                    status={review.status}
                    colorMap={REVIEW_STATUS_COLORS}
                    labelMap={REVIEW_STATUS_LABELS}
                  />
                </div>
                <p className="text-muted-foreground text-sm">
                  Reviewer:{" "}
                  {review.reviewer
                    ? `${review.reviewer.firstName} ${review.reviewer.lastName}`
                    : "Not assigned"}
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                {isCompleted ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                      Review Completed
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-xs">Self Rating</p>
                        <RatingStars value={review.selfRating} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-xs">Manager Rating</p>
                        <RatingStars value={review.managerRating} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-xs">Final Rating</p>
                        <RatingStars value={review.finalRating} />
                      </div>
                    </div>
                    {review.selfComments && (
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-xs font-medium">Your Comments</p>
                        <p className="text-sm">{review.selfComments}</p>
                      </div>
                    )}
                    {review.managerComments && (
                      <div className="bg-muted/30 space-y-1 rounded p-3">
                        <p className="text-muted-foreground text-xs font-medium">
                          Manager Feedback
                        </p>
                        <p className="text-sm">{review.managerComments}</p>
                      </div>
                    )}
                  </div>
                ) : isSelfReview ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
                      <CheckCircle2 className="h-4 w-4" />
                      Self-review submitted - awaiting manager review
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-xs">Self Rating</p>
                      <RatingStars value={review.selfRating} />
                    </div>
                    {review.selfComments && (
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-xs">Comments</p>
                        <p className="text-sm">{review.selfComments}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Self Rating</Label>
                      <StarRatingInput
                        value={form.selfRating}
                        onChange={(v) => setForm((f) => ({ ...f, selfRating: v }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Overall Comments</Label>
                      <textarea
                        className="bg-background focus:ring-ring min-h-[80px] w-full resize-none rounded border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
                        value={form.selfComments}
                        onChange={(e) => setForm((f) => ({ ...f, selfComments: e.target.value }))}
                        placeholder="How did you perform this period?"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Key Achievements</Label>
                      <textarea
                        className="bg-background focus:ring-ring min-h-[80px] w-full resize-none rounded border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
                        value={form.achievements}
                        onChange={(e) => setForm((f) => ({ ...f, achievements: e.target.value }))}
                        placeholder="What did you accomplish this period?"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Areas for Improvement</Label>
                      <textarea
                        className="bg-background focus:ring-ring min-h-[80px] w-full resize-none rounded border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
                        value={form.improvements}
                        onChange={(e) => setForm((f) => ({ ...f, improvements: e.target.value }))}
                        placeholder="What would you like to improve?"
                      />
                    </div>
                    <div className="flex items-center gap-3 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => saveDraftMut.mutate(review.id)}
                        disabled={saveDraftMut.isPending}
                      >
                        {saveDraftMut.isPending && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Save Draft
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => submitMut.mutate(review.id)}
                        disabled={submitMut.isPending || !form.selfRating}
                      >
                        {submitMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Submit Self-Review
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right - Cycle info */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Cycle Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cycle</span>
                  <span className="font-medium">{review.cycle.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Year</span>
                  <span className="font-medium">{review.cycle.year}</span>
                </div>
                {review.submittedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Submitted</span>
                    <span className="font-medium">
                      {new Date(review.submittedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {review.completedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completed</span>
                    <span className="font-medium">
                      {new Date(review.completedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
