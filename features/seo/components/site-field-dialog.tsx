"use client"

import { useEffect, useMemo, useState } from "react"
import { Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { SeoConfig } from "../types"
import { useGscSites, useUpdateSeoSite, type SeoSiteInput } from "../hooks/use-seo"
import { TagListInput } from "./tag-list-input"
import { AiSuggestDialog } from "./ai-suggest-dialog"

// =============================================================================
// One dialog per setting, instead of a single form holding every field.
//
// The combined form put nine unrelated inputs on screen at once, so a person who
// only wanted to add a competitor had to scan past keywords, targets and GA4 to
// find it. Each field here opens on its own with the explanation that belongs to
// it, and saves just that change.
//
// The update route validates the whole property, so every save merges the edited
// field over the site's current values rather than sending a partial object.
// =============================================================================

export type SiteField =
  | "identity"
  | "gsc"
  | "keywords"
  | "pages"
  | "competitors"
  | "ga4"
  | "targets"
  | "options"

const META: Record<SiteField, { title: string; description: string }> = {
  identity: {
    title: "Name and domain",
    description: "How this site is labelled in reports, and the host it lives on.",
  },
  gsc: {
    title: "Search Console property",
    description:
      "Which property to pull queries, clicks and positions from. This is the backbone of every report.",
  },
  keywords: {
    title: "Money keywords",
    description:
      "The 5 to 10 commercial terms this site is judged on. Tracked weekly, with an alert when one slips off page one.",
  },
  pages: {
    title: "Money pages",
    description:
      "The 5 to 10 pages that actually earn. Technical audits, Core Web Vitals and the daily monitor all run against these.",
  },
  competitors: {
    title: "Competitors",
    description:
      "3 to 5 real competitors. We crawl their pages and show which topics they cover that you do not.",
  },
  ga4: {
    title: "GA4 property",
    description:
      "Search Console proves clicks. GA4 proves they convert, and it is where AI assistant referrals are counted.",
  },
  targets: {
    title: "Targets",
    description: "What good looks like for this site. Alerts fire when the pace falls behind.",
  },
  options: {
    title: "Options",
    description: "Whether this is the project's headline site, and whether it syncs each week.",
  },
}

export function SiteFieldDialog({
  projectId,
  site,
  field,
  open,
  onOpenChange,
}: {
  projectId: string
  site: SeoConfig
  field: SiteField
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const update = useUpdateSeoSite(projectId)
  const [aiOpen, setAiOpen] = useState(false)

  // Local draft of just the fields this dialog owns.
  const [label, setLabel] = useState(site.label)
  const [domain, setDomain] = useState(site.domain)
  const [siteUrl, setSiteUrl] = useState(site.siteUrl ?? "")
  const [gaPropertyId, setGaPropertyId] = useState(site.gaPropertyId ?? "")
  const [keywords, setKeywords] = useState<string[]>(site.moneyKeywords)
  const [pages, setPages] = useState<string[]>(site.moneyPages ?? [])
  const [competitors, setCompetitors] = useState<string[]>(site.competitors)
  const [targetClicks, setTargetClicks] = useState(
    site.targetClicks != null ? String(site.targetClicks) : "",
  )
  const [targetPosition, setTargetPosition] = useState(
    site.targetPosition != null ? String(site.targetPosition) : "",
  )
  const [isPrimary, setIsPrimary] = useState(site.isPrimary)
  const [isActive, setIsActive] = useState(site.isActive)

  // Re-seed each time it opens so a cancelled edit never leaks into the next one.
  useEffect(() => {
    if (!open) return
    setLabel(site.label)
    setDomain(site.domain)
    setSiteUrl(site.siteUrl ?? "")
    setGaPropertyId(site.gaPropertyId ?? "")
    setKeywords(site.moneyKeywords)
    setPages(site.moneyPages ?? [])
    setCompetitors(site.competitors)
    setTargetClicks(site.targetClicks != null ? String(site.targetClicks) : "")
    setTargetPosition(site.targetPosition != null ? String(site.targetPosition) : "")
    setIsPrimary(site.isPrimary)
    setIsActive(site.isActive)
  }, [open, site])

  const { data: gscData } = useGscSites(open && field === "gsc")
  const suggestions = useMemo(() => {
    const all = gscData?.sites ?? []
    const host = site.domain.toLowerCase()
    const matching = all.filter((s) => s.siteUrl.toLowerCase().includes(host))
    return (matching.length ? matching : all).slice(0, 6)
  }, [gscData, site.domain])

  const save = () => {
    // The route validates the full property, so send current values with this
    // dialog's field overridden.
    const base: SeoSiteInput & { propertyId: string } = {
      propertyId: site.id,
      label: site.label,
      domain: site.domain,
      siteUrl: site.siteUrl,
      gaPropertyId: site.gaPropertyId,
      moneyKeywords: site.moneyKeywords,
      moneyPages: site.moneyPages ?? [],
      competitors: site.competitors,
      targetClicks: site.targetClicks,
      targetPosition: site.targetPosition,
      isPrimary: site.isPrimary,
      isActive: site.isActive,
    }

    const patch: Partial<SeoSiteInput> =
      field === "identity"
        ? { label: label.trim(), domain: domain.trim() }
        : field === "gsc"
          ? { siteUrl: siteUrl.trim() || null }
          : field === "keywords"
            ? { moneyKeywords: keywords }
            : field === "pages"
              ? { moneyPages: pages }
              : field === "competitors"
                ? { competitors }
                : field === "ga4"
                  ? { gaPropertyId: gaPropertyId.trim() || null }
                  : field === "targets"
                    ? {
                        targetClicks: targetClicks.trim() ? Number(targetClicks) : null,
                        targetPosition: targetPosition.trim() ? Number(targetPosition) : null,
                      }
                    : { isPrimary, isActive }

    update.mutate({ ...base, ...patch }, { onSuccess: () => onOpenChange(false) })
  }

  const invalid = field === "identity" && (!label.trim() || !domain.trim())
  const meta = META[field]

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{meta.title}</DialogTitle>
            <DialogDescription>{meta.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {field === "identity" && (
              <>
                <Field
                  label="Name"
                  hint='How it appears in reports, such as "Main site" or "Blog".'
                >
                  <Input value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
                </Field>
                <Field label="Domain" hint="Just the host. Any https:// or path is stripped.">
                  <Input
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="blog.example.com"
                  />
                </Field>
              </>
            )}

            {field === "gsc" && (
              <Field
                label="Property"
                hint={`Use the URL prefix form (https://${site.domain}/) to keep a subdomain's queries separate, or leave blank to fall back to the domain property.`}
              >
                <Input
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  placeholder={`sc-domain:${site.domain}`}
                  autoFocus
                />
                {suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2">
                    <span className="text-muted-foreground w-full text-[11px]">
                      Properties this service account can read:
                    </span>
                    {suggestions.map((s) => (
                      <button
                        key={s.siteUrl}
                        type="button"
                        onClick={() => setSiteUrl(s.siteUrl)}
                        className="bg-muted hover:bg-muted/70 rounded-[2px] px-2 py-0.5 text-[11px]"
                      >
                        {s.siteUrl}
                      </button>
                    ))}
                  </div>
                )}
              </Field>
            )}

            {field === "keywords" && (
              <Field label="Keywords" hint="Type a keyword and press Enter.">
                <TagListInput
                  values={keywords}
                  onChange={setKeywords}
                  placeholder="dna health test"
                  autoFocus
                />
              </Field>
            )}

            {field === "pages" && (
              <Field label="Page URLs" hint="Full URLs. Type one and press Enter.">
                <TagListInput
                  values={pages}
                  onChange={setPages}
                  placeholder={`https://${site.domain}/pricing`}
                  autoFocus
                  normalize={(v) =>
                    /^https?:\/\//i.test(v.trim())
                      ? v.trim()
                      : `https://${v.trim().replace(/^\/+/, "")}`
                  }
                  validate={(v) => {
                    try {
                      new URL(v)
                      return null
                    } catch {
                      return "That does not look like a URL."
                    }
                  }}
                />
              </Field>
            )}

            {field === "competitors" && (
              <Field label="Competitor domains" hint="Type a domain and press Enter.">
                <TagListInput
                  values={competitors}
                  onChange={setCompetitors}
                  placeholder="competitor.com"
                  autoFocus
                  normalize={(v) =>
                    v
                      .trim()
                      .replace(/^https?:\/\//i, "")
                      .replace(/^www\./i, "")
                      .replace(/\/.*$/, "")
                      .toLowerCase()
                  }
                  validate={(v) =>
                    /^[a-z0-9.-]+\.[a-z]{2,}$/.test(v) ? null : "Enter a domain like competitor.com"
                  }
                />
              </Field>
            )}

            {field === "ga4" && (
              <Field
                label="GA4 property id"
                hint="The numeric id from GA4 Admin, Property settings. Not the G- measurement id."
              >
                <Input
                  value={gaPropertyId}
                  onChange={(e) => setGaPropertyId(e.target.value)}
                  placeholder="123456789"
                  inputMode="numeric"
                  autoFocus
                />
              </Field>
            )}

            {field === "targets" && (
              <>
                <Field
                  label="Monthly organic clicks target"
                  hint="A realistic number for the next quarter. Leave blank for no target."
                >
                  <Input
                    type="number"
                    min={0}
                    value={targetClicks}
                    onChange={(e) => setTargetClicks(e.target.value)}
                    placeholder="1000"
                    autoFocus
                  />
                </Field>
                <Field
                  label="Target average position"
                  hint="Where you want money keywords to sit. 10 means page one."
                >
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    step="0.1"
                    value={targetPosition}
                    onChange={(e) => setTargetPosition(e.target.value)}
                    placeholder="10"
                  />
                </Field>
              </>
            )}

            {field === "options" && (
              <div className="space-y-3">
                <Toggle
                  checked={isPrimary}
                  onChange={setIsPrimary}
                  label="Primary site"
                  hint="The headline site for this project. Only one can hold it."
                />
                <Toggle
                  checked={isActive}
                  onChange={setIsActive}
                  label="Include in weekly sync"
                  hint="Turn off to pause syncing without losing stored history."
                />
              </div>
            )}
          </div>

          <DialogFooter className="sm:justify-between">
            {(field === "keywords" || field === "competitors") && (
              <Button variant="outline" onClick={() => setAiOpen(true)}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Suggest with AI
              </Button>
            )}
            <div className="flex gap-2 sm:ml-auto">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={update.isPending}
              >
                Cancel
              </Button>
              <Button onClick={save} disabled={update.isPending || invalid}>
                {update.isPending ? "Saving" : "Save"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {aiOpen && (
        <AiSuggestDialog
          projectId={projectId}
          propertyId={site.id}
          siteLabel={site.label}
          task={field === "keywords" ? "keywords" : "competitors"}
          open={aiOpen}
          onOpenChange={(v) => {
            setAiOpen(v)
            // The AI dialog saves through the same route, so close this one too
            // and let the refreshed site data flow back in.
            if (!v) onOpenChange(false)
          }}
        />
      )}
    </>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-[11px]">{hint}</p>}
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint: string
}) {
  return (
    <label className="flex items-start gap-3">
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="text-muted-foreground block text-xs">{hint}</span>
      </span>
    </label>
  )
}
