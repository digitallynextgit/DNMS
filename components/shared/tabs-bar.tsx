"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"

// ─────────────────────────────────────────────────────────────────────────────
// The tab strip, declared as DATA rather than markup.
//
// Every page used to hand-write its own <TabsList><TabsTrigger>…, and they had
// drifted apart in every direction that is invisible one page at a time and
// obvious when you move between them:
//
//   • the icon/label gap was written three ways - `gap-1.5`,
//     `flex items-center gap-1.5`, and not at all
//   • icons were sized per call site, split between 14px and 16px
//   • one page dropped its triggers to `text-xs`
//   • the space under the strip was `mb-2`, `mb-4`, or nothing
//   • counts were written as "Full-time (3)" on one page and as a pill on
//     another
//
// None of that is a decision worth making twice, so it is made here. A page
// says WHICH tabs it has; this says what a tab looks like. `gap-1.5` and the
// icon size moved into TabsTrigger itself, so even the two components that
// need their own list markup (the project bar's overflow strips, the drilldown
// dialog) render triggers identical to these.
// ─────────────────────────────────────────────────────────────────────────────

export interface TabItem {
  value: string
  label: React.ReactNode
  /** Lucide icon. Sized by TabsTrigger - do not pass a size class. */
  icon?: React.ComponentType<{ className?: string }>
  /**
   * A plain trailing count, rendered as "Full-time (3)".
   *
   * The house pattern for "how many are in here", as opposed to `badge`, which
   * shouts. `0` still renders: "Requests (0)" is an answer, and a count that
   * vanishes at zero makes the tab jump width as data loads.
   */
  count?: number
  /**
   * An attention pill - unread messages, open requirements. Hidden at 0,
   * because "nothing needs you" is exactly when it should not be shouting.
   */
  badge?: number
  /** Tailwind background for the badge. Defaults to destructive. */
  badgeClassName?: string
}

/** Lets a caller write `canWrite && { value, label }` inline. */
export type TabEntry = TabItem | false | null | undefined

function Badge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        "ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-sm px-1 text-[10px] leading-none font-semibold text-white",
        className ?? "bg-destructive",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  )
}

export function TabsBar({
  items,
  /**
   * Spacing below the strip. The default is the one every page should use;
   * `none` is for the handful that sit inside a header row which already
   * spaces itself.
   */
  spacing = "default",
  className,
}: {
  items: readonly TabEntry[]
  spacing?: "default" | "none"
  className?: string
}) {
  const tabs = items.filter((i): i is TabItem => Boolean(i))
  if (tabs.length === 0) return null

  return (
    <TabsList className={cn(spacing === "default" && "mb-4", className)}>
      {tabs.map((tab) => {
        const Icon = tab.icon
        return (
          <TabsTrigger key={tab.value} value={tab.value}>
            {Icon && <Icon />}
            {tab.label}
            {tab.count !== undefined && ` (${tab.count})`}
            {!!tab.badge && tab.badge > 0 && (
              <Badge count={tab.badge} className={tab.badgeClassName} />
            )}
          </TabsTrigger>
        )
      })}
    </TabsList>
  )
}
