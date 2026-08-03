"use client"

import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Check, Shuffle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/shared/spinner"
import { cn } from "@/lib/utils"
import {
  AVATAR_IDS,
  AVATAR_ROLES,
  avatarIdFromPath,
  avatarIdsForRole,
  avatarPath,
  roleOfAvatar,
} from "@/lib/avatars"

/**
 * Preset avatar picker, for people who would rather not upload a photo of
 * themselves. Choosing one replaces any uploaded photo (and frees its bucket
 * object), so the two are alternatives rather than layers.
 *
 * Grouped by job role: 42 faces in one grid is a search task, 6 under a heading
 * you identify with is a choice.
 */
export function AvatarPickerDialog({
  employeeId,
  currentPhoto,
  open,
  onOpenChange,
}: {
  employeeId: string
  /** Current profilePhoto value, used to preselect if it is already a preset. */
  currentPhoto?: string | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<string | null>(null)

  // Reopening should always start from what is actually saved, not from a
  // selection the user abandoned last time.
  useEffect(() => {
    if (open) setSelected(avatarIdFromPath(currentPhoto))
  }, [open, currentPhoto])

  const save = useMutation({
    mutationFn: async (avatarId: string) => {
      const res = await fetch(`/api/employees/${employeeId}/photo`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarId }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed")
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee"] })
      qc.invalidateQueries({ queryKey: ["employees"] })
      toast.success("Avatar updated")
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const surpriseMe = () => {
    const pool = AVATAR_IDS.filter((id) => id !== selected)
    setSelected(pool[Math.floor(Math.random() * pool.length)] ?? AVATAR_IDS[0]!)
  }

  const selectedRole = selected ? roleOfAvatar(selected) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm">Choose an avatar</DialogTitle>
          <DialogDescription className="text-xs">
            Prefer not to upload a photo? Pick one of these instead. It replaces your current photo
            and shows everywhere your name appears.
          </DialogDescription>
        </DialogHeader>

        <div className="-mr-2 max-h-[55vh] space-y-5 overflow-y-auto pr-2 pb-1">
          {AVATAR_ROLES.map((role) => (
            <section key={role.key}>
              <div className="mb-2 flex items-baseline gap-2">
                <h3 className="text-xs font-semibold">{role.label}</h3>
                <span className="text-muted-foreground text-[11px]">{role.hint}</span>
              </div>

              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {avatarIdsForRole(role.key).map((id) => {
                  const isSelected = selected === id
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`${role.label} avatar ${id.slice(-2)}`}
                      onClick={() => setSelected(id)}
                      className={cn(
                        "group relative aspect-square w-full overflow-hidden rounded-[2px] border-2 transition-all duration-150",
                        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                        // Handling the things, not reading a list.
                        "hover:-translate-y-0.5 hover:shadow-md",
                        isSelected
                          ? "border-primary ring-primary/30 shadow-md ring-2"
                          : "hover:border-border border-transparent",
                      )}
                    >
                      {/* A plain img, not next/image: these are local static
                          assets, so the optimiser has nothing to do, and its
                          intrinsic 100x100 overflowed the grid cell. */}
                      <img
                        src={avatarPath(id)}
                        alt=""
                        loading="lazy"
                        className="block h-full w-full object-cover"
                      />
                      {isSelected && (
                        <span className="bg-primary text-primary-foreground absolute right-1 bottom-1 flex size-4 items-center justify-center rounded-[2px] shadow">
                          <Check className="size-3" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        <DialogFooter className="border-t pt-3 sm:justify-between">
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={surpriseMe}>
              <Shuffle className="mr-1.5 h-3.5 w-3.5" />
              Surprise me
            </Button>
            {selected && (
              <span className="text-muted-foreground hidden items-center gap-2 text-xs sm:flex">
                <img src={avatarPath(selected)} alt="" className="size-6 rounded" />
                {selectedRole?.label}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selected || save.isPending}
              onClick={() => selected && save.mutate(selected)}
            >
              {save.isPending && <Spinner size="sm" className="mr-1.5" />}
              Use this avatar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
