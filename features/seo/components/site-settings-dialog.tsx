"use client"

import { useState } from "react"
import { ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { SeoConfig } from "../types"
import { SiteFieldDialog, type SiteField } from "./site-field-dialog"

// =============================================================================
// The settings hub for one site: every setting as a row showing its current
// value, opening its own focused dialog. Replaces the single form that showed
// all nine inputs at once.
//
// Rows that are empty but matter are flagged, so "what still needs filling in"
// is answerable at a glance rather than by reading each box.
// =============================================================================

interface Row {
  field: SiteField
  label: string
  value: string
  empty: boolean
  /** Empty is a real problem, not just an unused option. */
  needed?: boolean
}

export function SiteSettingsDialog({
  projectId,
  site,
  open,
  onOpenChange,
  /** Open straight into one setting, used by the setup guide. */
  initialField = null,
}: {
  projectId: string
  site: SeoConfig
  open: boolean
  onOpenChange: (v: boolean) => void
  initialField?: SiteField | null
}) {
  const [field, setField] = useState<SiteField | null>(initialField)

  const list = (arr: string[] | undefined, unit: string) => {
    const a = arr ?? []
    if (a.length === 0) return "Not set"
    if (a.length <= 2) return a.join(", ")
    return `${a.length} ${unit}`
  }

  const rows: Row[] = [
    {
      field: "identity",
      label: "Name and domain",
      value: `${site.label} (${site.domain})`,
      empty: false,
    },
    {
      field: "gsc",
      label: "Search Console",
      value: site.siteUrl ?? "Falls back to the domain property",
      empty: !site.siteUrl,
    },
    {
      field: "keywords",
      label: "Money keywords",
      value: list(site.moneyKeywords, "keywords"),
      empty: site.moneyKeywords.length === 0,
      needed: true,
    },
    {
      field: "pages",
      label: "Money pages",
      value: list(site.moneyPages, "pages"),
      empty: (site.moneyPages ?? []).length === 0,
      needed: true,
    },
    {
      field: "competitors",
      label: "Competitors",
      value: list(site.competitors, "domains"),
      empty: site.competitors.length === 0,
      needed: true,
    },
    {
      field: "ga4",
      label: "GA4 property",
      value: site.gaPropertyId ?? "Not connected",
      empty: !site.gaPropertyId,
      needed: true,
    },
    {
      field: "targets",
      label: "Targets",
      value:
        site.targetClicks || site.targetPosition
          ? [
              site.targetClicks ? `${site.targetClicks.toLocaleString("en-IN")} clicks/mo` : null,
              site.targetPosition ? `avg position ${site.targetPosition}` : null,
            ]
              .filter(Boolean)
              .join(", ")
          : "No targets set",
      empty: !site.targetClicks && !site.targetPosition,
    },
    {
      field: "options",
      label: "Options",
      value: [site.isPrimary ? "Primary" : null, site.isActive ? "Weekly sync on" : "Sync paused"]
        .filter(Boolean)
        .join(", "),
      empty: false,
    },
  ]

  return (
    <>
      <Dialog open={open && !field} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{site.label} settings</DialogTitle>
            <DialogDescription>
              Pick a setting to edit. Each one opens on its own with what it affects.
            </DialogDescription>
          </DialogHeader>

          <div className="divide-border/60 divide-y">
            {rows.map((row) => (
              <button
                key={row.field}
                type="button"
                onClick={() => setField(row.field)}
                className="hover:bg-muted/50 flex w-full items-center gap-3 px-1 py-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{row.label}</span>
                    {row.empty && row.needed && (
                      <Badge
                        variant="outline"
                        className="border-amber-500/40 text-[10px] text-amber-600"
                      >
                        needed
                      </Badge>
                    )}
                  </div>
                  <p
                    className={cn(
                      "truncate text-xs",
                      row.empty ? "text-muted-foreground/70 italic" : "text-muted-foreground",
                    )}
                    title={row.value}
                  >
                    {row.value}
                  </p>
                </div>
                <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
              </button>
            ))}
          </div>

          <div className="flex justify-end pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {field && (
        <SiteFieldDialog
          projectId={projectId}
          site={site}
          field={field}
          open={!!field}
          onOpenChange={(v) => {
            if (!v) setField(null)
          }}
        />
      )}
    </>
  )
}
