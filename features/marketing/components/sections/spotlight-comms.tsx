import { MODULES } from "../../marketing.constants"
import { SpotlightSection } from "../spotlight-section"

const m = MODULES.find((x) => x.name === "Comms & Culture")!

/** Bespoke visual: a chat thread with two incoming bubbles, an outgoing bubble,
 *  a reaction pill, and a compact poll card with thin result bars. */
function CommsVisual() {
  const poll: [string, number][] = [
    ["Friday team lunch", 68],
    ["Offsite next month", 32],
  ]
  return (
    <div className="border-border bg-background flex h-full flex-col gap-3 rounded-[6px] border p-4">
      <div className="text-muted-foreground mb-1 flex items-center justify-between px-1 text-[10px] font-medium uppercase">
        <span>Team · Design</span>
        <span className="text-emerald-500">3 online</span>
      </div>

      {/* incoming */}
      <div className="flex max-w-[85%] flex-col gap-1">
        <div className="bg-muted text-foreground rounded-[6px] px-3 py-2 text-xs">
          Ship-ready mockups are in the vault
        </div>
        <div className="-mt-1 ml-1">
          <span className="border-border bg-card inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]">
            🔥 <span className="text-muted-foreground">4</span>
          </span>
        </div>
      </div>

      {/* incoming */}
      <div className="bg-muted text-foreground max-w-[85%] rounded-[6px] px-3 py-2 text-xs">
        Can we lock the launch date today?
      </div>

      {/* outgoing */}
      <div className="flex justify-end">
        <div className="bg-primary text-primary-foreground animate-dnms-fade-up max-w-[85%] rounded-[6px] px-3 py-2 text-xs">
          Yes - posting a poll now 👇
        </div>
      </div>

      {/* poll card */}
      <div className="border-border bg-card mt-auto rounded-[6px] border p-3">
        <div className="text-xs font-medium">When should we celebrate the launch?</div>
        <div className="mt-2.5 space-y-2">
          {poll.map(([label, pct]) => (
            <div key={label}>
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{label}</span>
                <span className="text-foreground tabular-nums">{pct}%</span>
              </div>
              <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SpotlightComms() {
  return (
    <SpotlightSection
      eyebrow={m.name}
      title={m.headline}
      text={m.text}
      points={m.points}
      visual={<CommsVisual />}
      reverse={false}
      tinted={true}
      bareVisual
    />
  )
}
