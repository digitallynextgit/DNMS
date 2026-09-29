"use client"

import { Minus, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * A quantity field with -/+ steppers. The value stays a STRING so HR can
 * clear the box and type; the steppers clamp at `min` and the dialogs
 * validate on save exactly as before.
 */
export function QtyInput({
  id,
  value,
  onChange,
  min = 0,
  className,
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  min?: number
  className?: string
}) {
  const current = Number(value)
  const safe = Number.isFinite(current) ? current : min

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Decrease"
        disabled={safe <= min}
        onClick={() => onChange(String(Math.max(min, safe - 1)))}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <Input
        id={id}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-center tabular-nums"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Increase"
        onClick={() => onChange(String(safe + 1))}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
