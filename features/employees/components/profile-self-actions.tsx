"use client"

import { useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Camera, ChevronDown, Trash2, Upload, UserMinus } from "lucide-react"
import { Spinner } from "@/components/shared/spinner"
import { Button } from "@/components/ui/button"
import { DateField } from "@/components/shared/date-field"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { FormDialog } from "@/components/shared/form-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  useMyResignation,
  useApplyResignation,
  useCancelResignation,
} from "@/features/resignations"

/**
 * Self-service actions shown on the employee's own /profile page:
 *   • Edit Profile Photo (upload / remove)
 *   • Apply Resignation  (submit → manager approval → account deactivated)
 * Replaces the old "Edit Profile" button.
 */
export function ProfileSelfActions({
  employeeId,
  hasPhoto = false,
  status,
}: {
  employeeId: string
  hasPhoto?: boolean
  status: string
}) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [resignOpen, setResignOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [lastWorkingDate, setLastWorkingDate] = useState("")

  const { data: resignation } = useMyResignation()
  const applyMut = useApplyResignation()
  const cancelMut = useCancelResignation()

  const refreshProfile = () => qc.invalidateQueries({ queryKey: ["employee"] })

  const photoMut = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch(`/api/employees/${employeeId}/photo`, { method: "POST", body: fd })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Upload failed")
      return res.json()
    },
    onSuccess: () => {
      refreshProfile()
      toast.success("Photo updated")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const removePhotoMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/photo`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed")
      return res.json()
    },
    onSuccess: () => {
      refreshProfile()
      toast.success("Photo removed")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function submitResignation() {
    applyMut.mutate(
      { reason: reason || undefined, requestedLastWorkingDate: lastWorkingDate || undefined },
      {
        onSuccess: () => {
          setResignOpen(false)
          setReason("")
          setLastWorkingDate("")
          toast.success("Resignation submitted for approval")
        },
        onError: (e: Error) => toast.error(e.message),
      },
    )
  }

  function withdraw() {
    if (!resignation) return
    cancelMut.mutate(resignation.id, {
      onSuccess: () => toast.success("Resignation withdrawn"),
      onError: (e: Error) => toast.error(e.message),
    })
  }

  const photoBusy = photoMut.isPending || removePhotoMut.isPending
  const alreadyResigned = status === "RESIGNED" || status === "TERMINATED"
  const isPending = resignation?.status === "PENDING"

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Edit Profile Photo */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={photoBusy}>
            {photoBusy ? (
              <Spinner size="sm" className="mr-1.5" />
            ) : (
              <Camera className="mr-1.5 h-3.5 w-3.5" />
            )}
            Edit Profile Photo
            <ChevronDown className="ml-1 h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => fileRef.current?.click()}>
            <Upload className="mr-2 h-3.5 w-3.5" />
            {hasPhoto ? "Upload new photo" : "Upload photo"}
          </DropdownMenuItem>
          {hasPhoto && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => removePhotoMut.mutate()}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Remove photo
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) photoMut.mutate(e.target.files[0])
          e.target.value = ""
        }}
      />

      {/* Resignation */}
      {alreadyResigned ? (
        <Badge variant="outline" className="border-destructive/40 text-destructive">
          Resigned
        </Badge>
      ) : isPending ? (
        <>
          <Badge
            variant="outline"
            className="border-amber-400/50 text-amber-600 dark:text-amber-400"
          >
            Resignation Pending
          </Badge>
          <Button
            variant="outline"
            size="sm"
            disabled={cancelMut.isPending}
            onClick={withdraw}
            loading={cancelMut.isPending}
          >
            Withdraw
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:bg-destructive/10"
          onClick={() => setResignOpen(true)}
        >
          <UserMinus className="mr-1.5 h-3.5 w-3.5" />
          Apply Resignation
        </Button>
      )}

      <FormDialog
        open={resignOpen}
        onOpenChange={setResignOpen}
        title="Apply for Resignation"
        description="Submit your resignation for manager approval. Share a reason and your requested last working day below."
        isPending={applyMut.isPending}
        submitLabel="Submit Request"
        submitVariant="destructive"
        onSubmit={(e) => {
          e.preventDefault()
          submitResignation()
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="res-reason">Reason</Label>
          <Textarea
            id="res-reason"
            rows={6}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Briefly share why you're resigning (optional)"
          />
        </div>
        <div className="space-y-2">
          <Label>Requested Last Working Day</Label>
          <DateField value={lastWorkingDate} onChange={setLastWorkingDate} />
        </div>
        <p className="text-muted-foreground text-xs">
          This sends a resignation request to your manager for approval. Once approved, your account
          is deactivated and you'll be signed out. You can withdraw it from your profile while it's
          still pending.
        </p>
      </FormDialog>
    </div>
  )
}
