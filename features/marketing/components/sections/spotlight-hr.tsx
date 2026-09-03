import { Users } from "lucide-react"

import { MODULES } from "../../marketing.constants"
import { SpotlightSection } from "../spotlight-section"

const m = MODULES.find((x) => x.name === "HR & People")!

/** Bespoke visual: a mini org-chart (root -> 3 reports) beside a compact
 *  directory list. Both panels stretch to full height so the card never shows
 *  empty background - the org chart centers in its frame, the directory rows
 *  grow to fill. */
function HrVisual() {
  const reports: [string, string, string][] = [
    ["DJ", "Diwakar Jha", "Software Developer"],
    ["AP", "Ayushi Pandey", "HR"],
    ["TJ", "Teesha Jain", "Account Manager"],
  ]
  const directory: [string, string, string][] = [
    ["MB", "Mridul Bisht", "Web Developer"],
    ["KJ", "Karan Joshi", "Full Stack Developer"],
    ["AJ", "Aashutosh Jaiswal", "Content Writer"],
  ]
  return (
    <div className="flex h-full flex-col gap-3 sm:flex-row">
      {/* org chart */}
      <div className="border-border bg-background relative flex flex-1 flex-col overflow-hidden rounded-sm border p-4">
        <div className="text-muted-foreground mb-3 text-[10px] font-medium uppercase">
          Org chart
        </div>
        <div className="flex flex-1 flex-col justify-center">
          {/* root node */}
          <div className="flex justify-center">
            <div className="border-border bg-card animate-dnms-bob-sm flex items-center gap-2 rounded-sm border px-3 py-2 shadow-sm">
              <span className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold">
                MJ
              </span>
              <div className="text-left">
                <div className="text-xs leading-tight font-semibold">Manpreet Jangra</div>
                <div className="text-muted-foreground text-[10px] leading-tight">COO</div>
              </div>
            </div>
          </div>
          {/* connectors */}
          <div aria-hidden className="relative mx-auto mt-3 h-5 w-[78%]">
            <span className="bg-border absolute top-0 left-1/2 h-2.5 w-px -translate-x-1/2" />
            <span className="bg-border absolute top-2.5 right-0 left-0 h-px" />
            <span className="bg-border absolute top-2.5 left-0 h-2.5 w-px" />
            <span className="bg-border absolute top-2.5 left-1/2 h-2.5 w-px -translate-x-1/2" />
            <span className="bg-border absolute top-2.5 right-0 h-2.5 w-px" />
          </div>
          {/* child nodes */}
          <div className="mt-1 grid grid-cols-3 gap-2">
            {reports.map(([initials, name, dept]) => (
              <div
                key={name}
                className="border-border bg-card flex flex-col items-center gap-1 rounded-sm border px-1 py-3 text-center"
              >
                <span className="bg-muted text-muted-foreground flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold">
                  {initials}
                </span>
                <span className="w-full truncate text-[10px] font-medium">{name}</span>
                <span className="text-muted-foreground text-[9px] leading-tight text-pretty">
                  {dept}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* directory */}
      <div className="border-border bg-background flex flex-1 flex-col rounded-sm border p-3">
        <div className="text-muted-foreground mb-2 px-1 text-[10px] font-medium uppercase">
          Directory
        </div>
        <div className="flex flex-1 flex-col justify-center gap-2">
          {directory.map(([initials, name, dept]) => (
            <div
              key={name}
              className="border-border/70 bg-card flex items-center gap-2 rounded-sm border px-2 py-2"
            >
              <span className="bg-primary/10 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
                {initials}
              </span>
              <span className="flex-1 truncate text-xs font-medium">{name}</span>
              <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap">
                {dept}
              </span>
            </div>
          ))}
        </div>
        <div className="text-muted-foreground mt-2 flex items-center gap-1.5 px-1 text-[10px]">
          <Users className="h-3 w-3" />
          <span>142 people · 9 departments</span>
        </div>
      </div>
    </div>
  )
}

export function SpotlightHr() {
  return (
    <SpotlightSection
      eyebrow={m.name}
      title={m.headline}
      text={m.text}
      points={m.points}
      visual={<HrVisual />}
      reverse={true}
      tinted={false}
    />
  )
}
