import { MARQUEE_ITEMS } from "../../marketing.constants"
import { Marquee } from "../fx"

function Chip({ label }: { label: string }) {
  return (
    <span className="border-border bg-card flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm whitespace-nowrap">
      <span className="bg-primary h-1.5 w-1.5 shrink-0 rounded-full" />
      {label}
    </span>
  )
}

/** Full-bleed band of two opposing marquee rows of capability chips. */
export function MarqueeStrip() {
  // Doubled so one copy always overflows; Marquee loops two copies at -50%.
  const firstRow = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS]
  const secondRow = [...MARQUEE_ITEMS].reverse()
  const secondRowDoubled = [...secondRow, ...secondRow]
  return (
    <section className="border-border/60 bg-muted/20 relative overflow-hidden border-y py-10">
      <div className="flex flex-col gap-4">
        <Marquee>
          {firstRow.map((item, i) => (
            <Chip key={`a-${i}`} label={item} />
          ))}
        </Marquee>
        <Marquee reverse>
          {secondRowDoubled.map((item, i) => (
            <Chip key={`b-${i}`} label={item} />
          ))}
        </Marquee>
      </div>

      <div
        aria-hidden
        className="from-background pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r to-transparent sm:w-40"
      />
      <div
        aria-hidden
        className="from-background pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l to-transparent sm:w-40"
      />
    </section>
  )
}
