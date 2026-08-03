"use client"

import { useEffect, useState } from "react"
import { Check, Search, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { CheckboxVisual } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { CompetitorSuggestionView, KeywordSuggestionView } from "../types"
import { useSeoAi, useSeoSites, useUpdateSeoSite } from "../hooks/use-seo"

// =============================================================================
// AI suggestions for money keywords / competitors.
//
// The model proposes; a human picks. Nothing is written until "Add selected" is
// pressed, and even then it goes through the ordinary site-settings update - so
// unreviewed machine output can never land in a client's tracked keywords.
// Each keyword the site ALREADY gets impressions for is badged, because those
// are facts from Search Console rather than the model's opinion.
// =============================================================================

export function AiSuggestDialog({
  projectId,
  propertyId,
  siteLabel,
  task,
  open,
  onOpenChange,
  onEditSite,
}: {
  projectId: string
  propertyId: string
  siteLabel: string
  task: "keywords" | "competitors"
  open: boolean
  onOpenChange: (v: boolean) => void
  onEditSite?: () => void
}) {
  const ai = useSeoAi(projectId)
  const { data: sitesData } = useSeoSites(projectId)
  const update = useUpdateSeoSite(projectId)

  const [keywords, setKeywords] = useState<KeywordSuggestionView[]>([])
  const [competitors, setCompetitors] = useState<CompetitorSuggestionView[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [ran, setRan] = useState(false)

  const site = sitesData?.properties.find((p) => p.id === propertyId) ?? null
  const isKeywords = task === "keywords"

  // Fetch once per open.
  useEffect(() => {
    if (!open || ran) return
    setRan(true)
    ai.mutate(
      { propertyId, task },
      {
        onSuccess: (d) => {
          const ks = d.keywords ?? []
          const cs = d.competitors ?? []
          setKeywords(ks)
          setCompetitors(cs)
          // Pre-select the safe ones: queries the site already ranks for.
          setPicked(new Set(ks.filter((k) => k.fromSearchConsole).map((k) => k.keyword)))
        },
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Reset when closed so reopening asks again.
  useEffect(() => {
    if (open) return
    setRan(false)
    setKeywords([])
    setCompetitors([])
    setPicked(new Set())
  }, [open])

  const items: { key: string; primary: string; secondary: string; badge?: string }[] = isKeywords
    ? keywords.map((k) => ({
        key: k.keyword,
        primary: k.keyword,
        secondary: k.reason,
        badge: k.fromSearchConsole ? "already ranking" : k.intent,
      }))
    : competitors.map((c) => ({ key: c.domain, primary: c.domain, secondary: c.reason }))

  const toggle = (key: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const apply = () => {
    if (!site || picked.size === 0) return
    const chosen = [...picked]
    const input = isKeywords
      ? { moneyKeywords: [...new Set([...site.moneyKeywords, ...chosen])] }
      : { competitors: [...new Set([...site.competitors, ...chosen])] }

    update.mutate(
      {
        propertyId,
        label: site.label,
        domain: site.domain,
        siteUrl: site.siteUrl,
        gaPropertyId: site.gaPropertyId,
        moneyKeywords: site.moneyKeywords,
        competitors: site.competitors,
        targetClicks: site.targetClicks,
        targetPosition: site.targetPosition,
        isPrimary: site.isPrimary,
        isActive: site.isActive,
        ...input,
      },
      {
        onSuccess: () => {
          toast.success(
            `Added ${chosen.length} ${isKeywords ? "keyword" : "competitor"}${chosen.length > 1 ? "s" : ""}`,
          )
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {isKeywords ? "Suggested money keywords" : "Suggested competitors"}
          </DialogTitle>
          <DialogDescription>
            {isKeywords
              ? `Based on ${siteLabel}'s real Search Console queries and pages. Pick the ones this business actually wants to win - you can edit them later.`
              : `Likely organic competitors for ${siteLabel}. Confirm each by searching your money keywords in an incognito window before relying on it.`}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[200px] space-y-2">
          {ai.isPending && (
            <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
              <Sparkles className="h-4 w-4 animate-pulse" />
              Analysing {siteLabel}…
            </div>
          )}

          {!ai.isPending && items.length === 0 && (
            <div className="py-8 text-center text-sm">
              <p className="font-medium">No suggestions</p>
              <p className="text-muted-foreground text-xs">
                {isKeywords
                  ? "There isn't enough Search Console history yet. Sync the site first, then try again."
                  : "The AI wasn't confident about any competitors. Add them manually in site settings."}
              </p>
              {onEditSite && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => {
                    onOpenChange(false)
                    onEditSite()
                  }}
                >
                  Open site settings
                </Button>
              )}
            </div>
          )}

          {items.map((item) => {
            const on = picked.has(item.key)
            return (
              <button
                key={item.key}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(item.key)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors",
                  on ? "border-primary/50 bg-primary/5" : "hover:bg-muted/50",
                )}
              >
                <CheckboxVisual checked={on} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{item.primary}</span>
                    {item.badge && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          item.badge === "already ranking" &&
                            "border-emerald-500/40 text-emerald-600",
                        )}
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                  {item.secondary && (
                    <p className="text-muted-foreground text-xs">{item.secondary}</p>
                  )}
                </div>
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(item.primary)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0"
                  title="Check this in Google"
                >
                  <Search className="h-3.5 w-3.5" />
                </a>
              </button>
            )
          })}
        </div>

        <DialogFooter className="sm:justify-between">
          <p className="text-muted-foreground text-xs">
            {picked.size > 0 ? `${picked.size} selected` : "AI suggestions - review before saving"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={apply} disabled={picked.size === 0 || update.isPending || !site}>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              {update.isPending ? "Saving…" : `Add selected`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
