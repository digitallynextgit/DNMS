"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const CURRENT_YEAR = new Date().getFullYear()

/** Three years either side of this one, plus `value` if it has drifted outside them. */
export function YearSelect({ value, onChange }: { value: number; onChange: (y: number) => void }) {
  const years: number[] = []
  for (let y = CURRENT_YEAR - 3; y <= CURRENT_YEAR + 3; y++) years.push(y)
  if (!years.includes(value)) years.push(value)
  years.sort((a, b) => a - b)

  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="w-28" aria-label="Year">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {years.map((y) => (
          <SelectItem key={y} value={String(y)}>
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
