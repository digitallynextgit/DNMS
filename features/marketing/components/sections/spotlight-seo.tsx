import { TrendingUp } from "lucide-react"

import { MODULES } from "../../marketing.constants"
import { SpotlightSection } from "../spotlight-section"

const m = MODULES.find((x) => x.name === "SEO Suite")!

/** Bespoke visual: a "Clicks" area chart trending up with a soft gradient fill,
 *  plus a keyword table with positions and green up-deltas that fills the height. */
function SeoVisual() {
  const rows: [string, string, string][] = [
    ["seo audit tool", "3", "+5"],
    ["keyword tracker", "6", "+2"],
    ["rank monitoring", "11", "+8"],
    ["backlink checker", "8", "+3"],
    ["serp preview", "14", "+6"],
  ]
  return (
    <div className="flex h-full flex-col gap-4">
      {/* chart */}
      <div className="border-border bg-background rounded-sm border p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-muted-foreground text-[10px] font-medium uppercase">Clicks</div>
            <div className="mt-0.5 text-xl font-semibold tabular-nums">18,240</div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-500">
            <TrendingUp className="h-3 w-3" /> +34%
          </span>
        </div>
        <svg viewBox="0 0 300 90" className="h-24 w-full" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="spotlight-seo-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.28" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon
            fill="url(#spotlight-seo-fill)"
            points="0,70 30,64 60,66 90,52 120,55 150,42 180,38 210,44 240,28 270,22 300,12 300,90 0,90"
          />
          <polyline
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points="0,70 30,64 60,66 90,52 120,55 150,42 180,38 210,44 240,28 270,22 300,12"
          />
        </svg>
      </div>

      {/* keyword table */}
      <div className="border-border bg-background flex flex-1 flex-col rounded-sm border p-3">
        <div className="text-muted-foreground mb-2 grid grid-cols-3 items-center gap-2 text-[10px] font-medium uppercase">
          <span>Keyword</span>
          <span className="text-center">Position</span>
          <span className="text-right">Trend</span>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          {rows.map(([kw, pos, delta]) => (
            <div key={kw} className="grid flex-1 grid-cols-3 items-center gap-2 text-xs">
              <span className="truncate">{kw}</span>
              <span className="w-9 justify-self-center text-right tabular-nums">#{pos}</span>
              <span className="inline-flex items-center justify-center gap-0.5 justify-self-end rounded-sm bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500">
                <TrendingUp className="h-2.5 w-2.5" />
                {delta}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SpotlightSeo() {
  return (
    <SpotlightSection
      eyebrow={m.name}
      title={m.headline}
      text={m.text}
      points={m.points}
      visual={<SeoVisual />}
      reverse={true}
      tinted={false}
    />
  )
}
