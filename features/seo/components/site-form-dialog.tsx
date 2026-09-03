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
import { useCreateSeoSite, useGscSites } from "../hooks/use-seo"

// Add a site. Deliberately only asks for the three things needed to start
// pulling data: what to call it, where it lives, and which Search Console
// property to read. Keywords, pages, competitors, GA4 and targets are each
// configured afterwards from the setup guide, one at a time, so nobody has to
// fill in nine boxes before seeing a single number.

export function SiteFormDialog({
  projectId,
  open,
  onOpenChange,
  gscConfigured,
}: {
  projectId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  gscConfigured: boolean
}) {
  const create = useCreateSeoSite(projectId)

  const [label, setLabel] = useState("")
  const [domain, setDomain] = useState("")
  const [siteUrl, setSiteUrl] = useState("")

  useEffect(() => {
    if (!open) return
    setLabel("")
    setDomain("")
    setSiteUrl("")
  }, [open])

  const { data: sitesData } = useGscSites(open && gscConfigured)
  const suggested = useMemo(() => {
    const host = domain.trim().toLowerCase()
    const all = sitesData?.sites ?? []
    if (!host) return all.slice(0, 6)
    return all.filter((s) => s.siteUrl.toLowerCase().includes(host)).slice(0, 6)
  }, [sitesData, domain])

  const submit = () =>
    create.mutate(
      {
        label: label.trim(),
        domain: domain.trim(),
        siteUrl: siteUrl.trim() || null,
      },
      { onSuccess: () => onOpenChange(false) },
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Track a new site</DialogTitle>
          <DialogDescription>
            Just the essentials for now. The setup guide walks you through keywords, pages and
            competitors once the site is added.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="new-site-label">Name</Label>
            <Input
              id="new-site-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Main site"
              autoFocus
            />
            <p className="text-muted-foreground text-[11px]">
              How it appears in reports. Subdomains of the same client belong here rather than in a
              separate project.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-site-domain">Domain</Label>
            <Input
              id="new-site-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="blog.example.com"
            />
            <p className="text-muted-foreground text-[11px]">
              Just the host. Any https:// or path is stripped automatically.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-site-gsc">Search Console property (optional)</Label>
            <Input
              id="new-site-gsc"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder={domain ? `sc-domain:${domain}` : "sc-domain:example.com"}
            />
            {suggested.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {suggested.map((s) => (
                  <button
                    key={s.siteUrl}
                    type="button"
                    onClick={() => setSiteUrl(s.siteUrl)}
                    className="bg-muted hover:bg-muted/70 rounded-sm px-2 py-0.5 text-[11px]"
                  >
                    {s.siteUrl}
                  </button>
                ))}
              </div>
            )}
            <p className="text-muted-foreground text-[11px]">
              Leave blank to use the domain property. You can change it later.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={create.isPending || !label.trim() || !domain.trim()}>
            {create.isPending ? "Adding" : "Add site"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
