"use client"

import { useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Camera, Loader2, UserMinus } from "lucide-react"
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
import { usePermissions } from "@/hooks/use-permissions"
import { PERMISSIONS } from "@/lib/constants"

export function EmployeeAdminActions({
  employeeId,
  status,
}: {
  employeeId: string
  status: string
}) {
  const { can } = usePermissions()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [resignOpen, setResignOpen] = useState(false)
  const [resignationDate, setResignationDate] = useState("")
  const [lastWorkingDate, setLastWorkingDate] = useState("")

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["employee", employeeId] })
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

  const resignMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "RESIGNED",
          resignationDate: resignationDate || undefined,
          lastWorkingDate: lastWorkingDate || undefined,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed")
      return res.json()
    },
    onSuccess: () => {
      refresh()
      setResignOpen(false)
      toast.success("Employee marked as resigned")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (!can(PERMISSIONS.EMPLOYEE_WRITE)) return null

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={photoMut.isPending}
        onClick={() => fileRef.current?.click()}
      >
        {photoMut.isPending ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Camera className="mr-1.5 h-3.5 w-3.5" />
        )}
        Photo
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && photoMut.mutate(e.target.files[0])}
      />

      {status !== "RESIGNED" && status !== "TERMINATED" && (
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
            <DialogTitle>Mark as Resigned</DialogTitle>
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
              This sets the employee to RESIGNED and deactivates their access.
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
