"use client"

import { useEffect, useMemo, useState } from "react"

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
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import type { SeoConfig } from "../types"
import {
  useCreateSeoSite,
  useGscSites,
  useUpdateSeoSite,
  type SeoSiteInput,
} from "../hooks/use-seo"

// Add or edit one tracked site. A project can hold many of these - KYG tracks 13
// subdomains under a single account.

const toLines = (arr: string[]) => arr.join("\n")
const fromLines = (s: string) =>
  s
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean)

export function SiteFormDialog({
  projectId,
  site,
  open,
  onOpenChange,
  gscConfigured,
}: {
  projectId: string
  /** null = create a new site. */
  site: SeoConfig | null
  open: boolean
  onOpenChange: (v: boolean) => void
  gscConfigured: boolean
}) {
  const create = useCreateSeoSite(projectId)
  const update = useUpdateSeoSite(projectId)
  const saving = create.isPending || update.isPending

  const [label, setLabel] = useState("")
  const [domain, setDomain] = useState("")
  const [siteUrl, setSiteUrl] = useState("")
  const [gaPropertyId, setGaPropertyId] = useState("")
  const [keywords, setKeywords] = useState("")
  const [competitors, setCompetitors] = useState("")
  const [targetClicks, setTargetClicks] = useState("")
  const [targetPosition, setTargetPosition] = useState("")
  const [isPrimary, setIsPrimary] = useState(false)
  const [isActive, setIsActive] = useState(true)

  // Re-seed whenever the dialog opens or switches to a different site.
  useEffect(() => {
    if (!open) return
    setLabel(site?.label ?? "")
    setDomain(site?.domain ?? "")
    setSiteUrl(site?.siteUrl ?? "")
    setGaPropertyId(site?.gaPropertyId ?? "")
    setKeywords(toLines(site?.moneyKeywords ?? []))
    setCompetitors(toLines(site?.competitors ?? []))
    setTargetClicks(site?.targetClicks != null ? String(site.targetClicks) : "")
    setTargetPosition(site?.targetPosition != null ? String(site.targetPosition) : "")
    setIsPrimary(site?.isPrimary ?? false)
    setIsActive(site?.isActive ?? true)
  }, [open, site])

  const { data: sitesData } = useGscSites(open && gscConfigured)
  const suggested = useMemo(() => {
    const host = domain.trim().toLowerCase()
    const all = sitesData?.sites ?? []
    if (!host) return all.slice(0, 6)
    return all.filter((s) => s.siteUrl.toLowerCase().includes(host))
  }, [sitesData, domain])

  const onSubmit = () => {
    const input: SeoSiteInput = {
      label: label.trim(),
      domain: domain.trim(),
      siteUrl: siteUrl.trim() || null,
      gaPropertyId: gaPropertyId.trim() || null,
      moneyKeywords: fromLines(keywords),
      competitors: fromLines(competitors),
      targetClicks: targetClicks.trim() ? Number(targetClicks) : null,
      targetPosition: targetPosition.trim() ? Number(targetPosition) : null,
      isPrimary,
      isActive,
    }
    const done = { onSuccess: () => onOpenChange(false) }
    if (site) update.mutate({ propertyId: site.id, ...input }, done)
    else create.mutate(input, done)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* DialogContent already pins the header/footer and scrolls the body -
          adding our own borders/padding here would double them up. */}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{site ? `Edit ${site.label}` : "Track a new site"}</DialogTitle>
          <DialogDescription>
            Each site gets its own Search Console tracking, keywords and targets. Subdomains of the
            same client belong here rather than in a separate project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="site-label">Name</Label>
              <Input
                id="site-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Blog"
              />
              <p className="text-muted-foreground text-[11px]">
                How it appears in reports, e.g. “Main site”, “Blog”, “Careers”.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="site-domain">Domain</Label>
              <Input
                id="site-domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="blog.example.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="site-gsc">Search Console property</Label>
            <Input
              id="site-gsc"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder={domain ? `https://${domain}/` : "https://blog.example.com/"}
            />
            {suggested.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {suggested.slice(0, 6).map((s) => (
                  <button
                    key={s.siteUrl}
                    type="button"
                    onClick={() => setSiteUrl(s.siteUrl)}
                    className="bg-muted hover:bg-muted/70 rounded px-2 py-0.5 text-[11px]"
                  >
                    {s.siteUrl}
                  </button>
                ))}
              </div>
            )}
            <p className="text-muted-foreground text-[11px]">
              For a subdomain use its URL-prefix property (
              <code>https://{domain || "blog.example.com"}/</code>) so its queries stay separate.
              Leave blank to fall back to the domain property.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="site-kw">Money keywords (one per line)</Label>
              <Textarea
                id="site-kw"
                rows={5}
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder={"digital marketing agency delhi\nseo services noida"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="site-comp">Competitors (one per line)</Label>
              <Textarea
                id="site-comp"
                rows={5}
                value={competitors}
                onChange={(e) => setCompetitors(e.target.value)}
                placeholder={"competitor1.com\ncompetitor2.com"}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="site-tc">Monthly clicks target</Label>
              <Input
                id="site-tc"
                type="number"
                min={0}
                value={targetClicks}
                onChange={(e) => setTargetClicks(e.target.value)}
                placeholder="1000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="site-tp">Target avg position</Label>
              <Input
                id="site-tp"
                type="number"
                min={1}
                max={100}
                step="0.1"
                value={targetPosition}
                onChange={(e) => setTargetPosition(e.target.value)}
                placeholder="10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="site-ga">GA4 property id</Label>
              <Input
                id="site-ga"
                value={gaPropertyId}
                onChange={(e) => setGaPropertyId(e.target.value)}
                placeholder="123456789"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={isPrimary} onCheckedChange={setIsPrimary} />
              Primary site
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              Include in weekly sync
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={saving || !label.trim() || !domain.trim()}>
            {saving ? "Saving…" : site ? "Save changes" : "Add site"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
