"use client"

import { useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Camera, ChevronDown, Loader2, Trash2, Upload, UserMinus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { usePermissions } from "@/hooks/use-permissions"
import { PERMISSIONS } from "@/lib/constants"
import { resignSelf } from "@/lib/actions/employees"

export function EmployeeAdminActions({
  employeeId,
  status,
  hasPhoto = false,
}: {
  employeeId: string
  status: string
  hasPhoto?: boolean
}) {
  const { can, userId } = usePermissions()
  // Photo upload is an admin (HR) action; Resign is self-service — an employee
  // resigns themselves, so it only appears on your own profile, never when an
  // admin views someone else.
  const canManage = can(PERMISSIONS.EMPLOYEE_WRITE)
  const isSelf = userId === employeeId
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [resignOpen, setResignOpen] = useState(false)
  const [resignationDate, setResignationDate] = useState("")
  const [lastWorkingDate, setLastWorkingDate] = useState("")

  const refresh = () => {
    // Broad key: the profile query may be keyed by a slug, not the raw id.
    qc.invalidateQueries({ queryKey: ["employee"] })
    qc.invalidateQueries({ queryKey: ["employees"] })
  }

  const photoMut = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch(`/api/employees/${employeeId}/photo`, { method: "POST", body: fd })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Upload failed")
      return res.json()
    },
    onSuccess: () => {
      refresh()
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
      refresh()
      toast.success("Photo removed")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const resignMut = useMutation({
    mutationFn: async () => {
      const r = await resignSelf({
        resignationDate: resignationDate || undefined,
        lastWorkingDate: lastWorkingDate || undefined,
      })
      if (!r.ok) throw new Error(r.error)
      return r.data
    },
    onSuccess: () => {
      refresh()
      setResignOpen(false)
      toast.success("Resignation submitted")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!canManage && !isSelf) return null

  return (
    <>
      {canManage && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={photoMut.isPending || removePhotoMut.isPending}
              >
                {photoMut.isPending || removePhotoMut.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="mr-1.5 h-3.5 w-3.5" />
                )}
                Photo
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
        </>
      )}

      {isSelf && status !== "RESIGNED" && status !== "TERMINATED" && (
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:bg-destructive/10"
          onClick={() => setResignOpen(true)}
        >
          <UserMinus className="mr-1.5 h-3.5 w-3.5" />
          Resign
        </Button>
      )}

      <Dialog open={resignOpen} onOpenChange={setResignOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Submit Resignation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="res-date">Resignation Date</Label>
              <Input
                id="res-date"
                type="date"
                value={resignationDate}
                onChange={(e) => setResignationDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lwd">Last Working Day</Label>
              <Input
                id="lwd"
                type="date"
                value={lastWorkingDate}
                onChange={(e) => setLastWorkingDate(e.target.value)}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              This marks your status as RESIGNED and notifies HR. You can leave the dates blank if
              they're not finalized yet.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResignOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={resignMut.isPending}
              onClick={() => resignMut.mutate()}
            >
              {resignMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
