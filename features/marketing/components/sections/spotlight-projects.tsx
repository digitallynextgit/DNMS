import { MODULES } from "../../marketing.constants"
import { cn } from "@/lib/utils"
import { SpotlightSection } from "../spotlight-section"

const m = MODULES.find((x) => x.name === "Projects & Delivery")!

interface KanbanCard {
  title: string
  who: string
  priority: "high" | "med" | "low"
}

interface KanbanColumn {
  name: string
  accent: string // header dot
  card: string // task-card tint
  cards: KanbanCard[]
}

/** Bespoke visual: a mini kanban board with To do / In progress / Done columns.
 *  Cards fill each full-height column; the active card gently bobs (contained). */
function ProjectsVisual() {
  const columns: KanbanColumn[] = [
    {
      name: "To do",
      accent: "bg-muted-foreground/40",
      card: "border-border/70 bg-card",
      cards: [
        { title: "Draft homepage copy", who: "AS", priority: "med" },
        { title: "Import contact list", who: "DP", priority: "low" },
      ],
    },
    {
      name: "In progress",
      accent: "bg-blue-500",
      card: "border-blue-500/30 bg-blue-500/5",
      cards: [
        { title: "Build pricing page", who: "KM", priority: "high" },
        { title: "Wire up checkout", who: "DP", priority: "med" },
      ],
    },
    {
      name: "Done",
      accent: "bg-emerald-500",
      card: "border-emerald-500/30 bg-emerald-500/5",
      cards: [
        { title: "Kickoff & scope", who: "MR", priority: "med" },
        { title: "Brand & logo assets", who: "AS", priority: "low" },
      ],
    },
  ]
  const dot: Record<KanbanCard["priority"], string> = {
    high: "bg-red-500",
    med: "bg-amber-500",
    low: "bg-emerald-500",
  }

  return (
    <div className="flex h-full gap-3">
      {columns.map((col) => (
        <div
          key={col.name}
          className="border-border bg-background flex flex-1 flex-col rounded-[6px] border p-2.5"
        >
          <div className="mb-2 flex items-center gap-1.5 px-0.5">
            <span className={`h-1.5 w-1.5 rounded-full ${col.accent}`} />
            <span className="text-[10px] font-semibold tracking-wide uppercase">{col.name}</span>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            {col.cards.map((card, i) => {
              const active = col.name === "In progress" && i === 0
              return (
                <div
                  key={card.title}
                  className={cn(
                    "flex flex-1 flex-col rounded-[6px] border p-2",
                    col.card,
                    active && "animate-dnms-bob-sm shadow-sm",
                  )}
                >
                  <div className="text-xs leading-snug font-medium text-pretty">{card.title}</div>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="bg-primary/10 text-primary flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold">
                      {card.who}
                    </span>
                    <span className={`h-2 w-2 rounded-full ${dot[card.priority]}`} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export function SpotlightProjects() {
  return (
    <SpotlightSection
      eyebrow={m.name}
      title={m.headline}
      text={m.text}
      points={m.points}
      visual={<ProjectsVisual />}
      reverse
      tinted={false}
      titleBreak
    />
  )
}
