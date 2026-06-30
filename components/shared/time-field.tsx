"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

// shadcn time picker (hour / minute / AM-PM) so we don't depend on the native
// <input type="time">. Value is a 24-hour "HH:MM" string (or "" when unset).

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"))

function parse(value: string): { hour: string; minute: string; mer: "AM" | "PM" } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value || "")
  if (!m) return { hour: "", minute: "", mer: "AM" }
  let h = Number(m[1])
  const mer: "AM" | "PM" = h >= 12 ? "PM" : "AM"
  h = h % 12 || 12
  return { hour: String(h), minute: m[2], mer }
}

function compose(hour: string, minute: string, mer: "AM" | "PM"): string {
  if (!hour || minute === "") return ""
  let h = Number(hour) % 12
  if (mer === "PM") h += 12
  return `${String(h).padStart(2, "0")}:${minute}`
}

export function TimeField({
  value,
  onChange,
  modal,
  className,
}: {
  value: string
  onChange: (v: string) => void
  /** Set when rendered inside a Dialog so the dropdowns layer correctly. */
  modal?: boolean
  className?: string
}) {
  const { hour, minute, mer } = parse(value)
  const set = (h: string, m: string, p: "AM" | "PM") => onChange(compose(h, m, p))

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Select value={hour} onValueChange={(v) => set(v, minute || "00", mer)}>
        <SelectTrigger className="w-16">
          <SelectValue placeholder="HH" />
        </SelectTrigger>
        <SelectContent className="max-h-60" position="popper">
          {HOURS.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-muted-foreground">:</span>
      <Select value={minute} onValueChange={(v) => set(hour || "12", v, mer)}>
        <SelectTrigger className="w-16">
          <SelectValue placeholder="MM" />
        </SelectTrigger>
        <SelectContent className="max-h-60" position="popper">
          {MINUTES.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={mer}
        onValueChange={(v) => set(hour || "12", minute || "00", v as "AM" | "PM")}
      >
        <SelectTrigger className="w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
