"use client"

import { Globe, Search, Star } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useSeoRollup } from "../hooks/use-seo"

// A compact "what sites does this client have, and what's happening on them"
// card for the project Overview tab. An account like KYG has 13 subdomains; you
// shouldn't have to open the SEO tab to know they exist.

const num = (v: number) => v.toLocaleString("en-IN")

export function ProjectSitesCard({
  projectId,
  onOpenSeo,
}: {
  projectId: string
  /** Jump to the SEO tab (the caller owns tab state). */
  onOpenSeo?: () => void
}) {
  const { data, isLoading } = useSeoRollup(projectId, true)
  const sites = data?.properties ?? []

  // Nothing tracked yet: stay out of the way rather than showing an empty card
  // on every project that doesn't do SEO.
  if (isLoading || sites.length === 0) return null

  const totalOpen = sites.reduce((a, s) => a + s.openTasks, 0)
  const totalOverdue = sites.reduce((a, s) => a + s.overdueTasks, 0)

  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div>
            <p className="text-sm font-medium">
              Sites <span className="text-muted-foreground">({sites.length})</span>
            </p>
            <p className="text-muted-foreground text-xs">
              {data?.period
                ? `${num(data.totals.clicks.current)} clicks last week`
                : "No Search Console data yet"}
              {totalOpen > 0 && ` · ${totalOpen} open task${totalOpen > 1 ? "s" : ""}`}
              {totalOverdue > 0 && ` · ${totalOverdue} overdue`}
            </p>
          </div>
          {onOpenSeo && (
            <Button variant="outline" size="sm" onClick={onOpenSeo}>
              <Search className="mr-1.5 h-3.5 w-3.5" />
              Open SEO
            </Button>
          )}
        </div>

        <div className="divide-border/60 divide-y">
          {sites.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
              {s.isPrimary ? (
                <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
              ) : (
                <Globe className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              )}
              <span className="font-medium">{s.label}</span>
              <span className="text-muted-foreground text-xs">{s.domain}</span>
              {!s.isActive && (
                <Badge variant="outline" className="text-[10px]">
                  paused
                </Badge>
              )}
              <span className="ml-auto flex items-center gap-3 text-xs whitespace-nowrap">
                {s.period ? (
                  <span className="text-muted-foreground">{num(s.clicks.current)} clicks</span>
                ) : (
                  <span className="text-muted-foreground">not synced</span>
                )}
                {s.openTasks > 0 && (
                  <span className={cn(s.overdueTasks > 0 && "text-red-600")}>
                    {s.openTasks} open
                    {s.overdueTasks > 0 && ` · ${s.overdueTasks} late`}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
