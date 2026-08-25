import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { MODULES } from "../../marketing.constants"
import { SpotlightSection } from "../spotlight-section"

const m = MODULES.find((x) => x.name === "Recruitment & Hiring")!

interface Stage {
  name: string
  count: number
  chips: string[]
  accent?: boolean
}

/** Bespoke visual: a hiring pipeline as full-height lanes with count badges,
 *  sample candidate chips, a "+N more" footer and chevrons between stages;
 *  the Offer lane is accented. */
function RecruitmentVisual() {
  const stages: Stage[] = [
    { name: "Applied", count: 128, chips: ["AR", "DP", "SK", "RV"] },
    { name: "Screening", count: 42, chips: ["KM", "PT", "AS"] },
    { name: "Interview", count: 18, chips: ["MR", "ST", "DV"] },
    { name: "Offer", count: 5, chips: ["JV", "KP"], accent: true },
    { name: "Hired", count: 3, chips: ["NP", "AA"] },
  ]
  return (
    // Phones: stack the stages vertically (full-width, never cramped). Tablet+:
    // horizontal lanes with chevrons, scrolling (bar hidden) if they overflow.
    <div className="no-scrollbar flex h-full flex-col gap-2 sm:-mx-1 sm:flex-row sm:items-stretch sm:gap-1.5 sm:overflow-x-auto sm:px-1">
      {stages.map((s, i) => (
        <div key={s.name} className="flex sm:min-w-[64px] sm:flex-1 sm:items-stretch sm:gap-1.5">
          <div
            className={cn(
              "flex flex-1 flex-col rounded-[6px] border p-2.5",
              s.accent ? "border-primary/40 bg-primary/5" : "border-border bg-background",
            )}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-[10px] font-semibold">{s.name}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  s.accent ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {s.count}
              </span>
            </div>
            <div className="mt-2 space-y-1.5">
              {s.chips.map((c, ci) => (
                <div
                  key={c}
                  style={{ animationDelay: `${(i * 2 + ci) * 0.4}s` }}
                  className={cn(
                    "animate-dnms-bob-sm flex items-center gap-1.5 rounded-[6px] border px-1.5 py-1.5",
                    s.accent ? "border-primary/30 bg-card" : "border-border/70 bg-card",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold",
                      s.accent ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {c}
                  </span>
                  <span className="bg-muted-foreground/20 h-1 flex-1 rounded-full" />
                </div>
              ))}
            </div>
            {s.count > s.chips.length && (
              <div className="text-muted-foreground/60 mt-auto pt-2 text-center text-[9px] font-medium">
                +{s.count - s.chips.length} more
              </div>
            )}
          </div>
          {i < stages.length - 1 && (
            <div className="hidden items-center sm:flex">
              <ChevronRight className="text-muted-foreground/60 h-3.5 w-3.5" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function SpotlightRecruitment() {
  return (
    <SpotlightSection
      eyebrow={m.name}
      title={m.headline}
      text={m.text}
      points={m.points}
      visual={<RecruitmentVisual />}
      reverse={false}
      tinted
    />
  )
}
