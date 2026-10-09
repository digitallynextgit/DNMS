"use client"

import { Check } from "lucide-react"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { cn } from "@/lib/utils"
import {
  PROJECT_SERVICES,
  serviceInfo,
  type ProjectServiceCode,
  type ServiceOwner,
} from "../lib/project-services"

// One hue per service, so a column of chips can be scanned for "who has SEO".
const TINT: Record<ProjectServiceCode, string> = {
  SMO: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  PM: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  SEO: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  DPR: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  INF: "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30",
  ALL: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
  BD: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  WEB: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  CAMP: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30",
  MSG: "bg-lime-500/15 text-lime-700 dark:text-lime-300 border-lime-500/30",
  OFF: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  BRAND: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
}

/** `owner` undefined: ownership isn't shown here. null: shown as "no owner yet". */
export function ServiceChip({
  code,
  owner,
  className,
}: {
  code: string
  owner?: ServiceOwner["employee"] | null
  className?: string
}) {
  const info = serviceInfo(code)
  if (!info) return null
  const ownerName = owner ? `${owner.firstName} ${owner.lastName}`.trim() : null
  return (
    <span
      title={
        owner === undefined
          ? info.name
          : `${info.name} - ${ownerName ? `owner: ${ownerName}` : "no owner yet"}`
      }
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-sm border px-1.5 text-xs font-semibold whitespace-nowrap",
        owner && "pr-0.5",
        TINT[info.code],
        className,
      )}
    >
      {info.label}
      {owner && (
        <AvatarDisplay
          src={owner.profilePhoto}
          firstName={owner.firstName}
          lastName={owner.lastName}
          size="2xs"
        />
      )}
    </span>
  )
}

/** A project's services as chips, or a muted dash when none are set. Pass `owners` to show them. */
export function ServiceChips({
  services,
  owners,
  className,
}: {
  services: readonly string[]
  owners?: readonly ServiceOwner[]
  className?: string
}) {
  const known = PROJECT_SERVICES.filter((s) => services.includes(s.code))
  if (known.length === 0) return <span className="text-muted-foreground text-xs">-</span>
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {known.map((s) => (
        <ServiceChip
          key={s.code}
          code={s.code}
          owner={owners ? (owners.find((o) => o.service === s.code)?.employee ?? null) : undefined}
        />
      ))}
    </div>
  )
}

/** Toggle buttons for choosing a project's services. */
export function ServicePicker({
  value,
  onChange,
}: {
  value: readonly string[]
  onChange: (next: ProjectServiceCode[]) => void
}) {
  const toggle = (code: ProjectServiceCode) =>
    onChange(
      PROJECT_SERVICES.map((s) => s.code).filter((c) =>
        c === code ? !value.includes(c) : value.includes(c),
      ),
    )
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {PROJECT_SERVICES.map((s) => {
        const on = value.includes(s.code)
        return (
          <button
            key={s.code}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(s.code)}
            className={cn(
              "focus-visible:ring-ring flex items-center gap-2 rounded-sm border px-2 py-1.5 text-left text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none",
              on ? TINT[s.code] : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border",
                on ? "border-current" : "border-input",
              )}
            >
              {on && <Check className="h-3 w-3" />}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">{s.label}</span>
              <span className="block truncate text-[11px] opacity-80">{s.name}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
