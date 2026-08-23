import { STATS } from "../../marketing.constants"
import { CountUp, DotBackdrop, Reveal } from "../fx"

/**
 * A quiet band of four headline numbers, count-up on scroll, over a dotted
 * backdrop. Pure signal - the shape of the platform in four figures.
 */
export function StatsBand() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-28">
      <DotBackdrop />
      <div className="relative mx-auto max-w-[1600px] px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 100}>
              <div className="text-5xl font-bold tracking-tight text-[#ef4444] tabular-nums sm:text-6xl">
                <CountUp value={s.value} suffix={s.suffix ?? ""} />
              </div>
              <div className="mt-3 text-base font-semibold">{s.label}</div>
              <div className="text-muted-foreground mt-1 text-sm text-pretty">{s.sub}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
