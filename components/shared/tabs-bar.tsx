"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { TabsList, TabsTrigger, type TabsVariant } from "@/components/ui/tabs"

// Tab strips declared as data: a page says which tabs it has, this decides how a tab looks.

export interface TabItem {
  value: string
  label: React.ReactNode
  /** Lucide icon. Sized by TabsTrigger - do not pass a size class. */
  icon?: React.ComponentType<{ className?: string }>
  /** A plain trailing count, "Full-time (3)". Shown at 0 too, so the tab doesn't jump width. */
  count?: number
  /** An attention pill (unread, open requests). Hidden at 0. */
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
  /** `none` is for strips inside a header row that already spaces itself. */
  spacing = "default",
  /** `underline` for tabs nested inside a page's own tabs (e.g. the sections of a project tab). */
  variant = "pill",
  className,
}: {
  items: readonly TabEntry[]
  spacing?: "default" | "none"
  variant?: TabsVariant
  className?: string
}) {
  const tabs = items.filter((i): i is TabItem => Boolean(i))
  if (tabs.length === 0) return null

  return (
    <TabsList variant={variant} className={cn(spacing === "default" && "mb-4", className)}>
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
