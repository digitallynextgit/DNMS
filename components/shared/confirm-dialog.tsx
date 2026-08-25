"use client"

import { useEffect, useState } from "react"

import { Spinner } from "@/components/shared/spinner"

import { buttonVariants } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "destructive"
  onConfirm: () => void
  isLoading?: boolean
  /**
   * Hold the confirm button disabled for this many seconds after the dialog
   * opens, counting down on the label. For irreversible actions where the muscle
   * memory of click-then-click-again would otherwise fire before the sentence
   * has been read. Omit for ordinary confirms - a needless delay is just friction.
   */
  confirmDelaySeconds?: number
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  isLoading = false,
  confirmDelaySeconds = 0,
}: ConfirmDialogProps) {
  const [secondsLeft, setSecondsLeft] = useState(0)

  // Restart on every open, so reopening never inherits a spent countdown.
  useEffect(() => {
    if (!open || confirmDelaySeconds <= 0) {
      setSecondsLeft(0)
      return
    }
    setSecondsLeft(confirmDelaySeconds)
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timer)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [open, confirmDelaySeconds])

  const waiting = secondsLeft > 0

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-sm font-semibold tracking-tight">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground text-sm">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading} className="text-sm">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
            disabled={isLoading || waiting}
            className={cn(
              variant === "destructive" && buttonVariants({ variant: "destructive" }),
              waiting && "tabular-nums",
            )}
          >
            {isLoading && <Spinner size="sm" className="mr-2" />}
            {waiting ? `${confirmLabel} (${secondsLeft})` : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
