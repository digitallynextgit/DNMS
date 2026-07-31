"use client"

import { useState } from "react"
import { Download, Link2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import type { BacklinkSummaryView } from "../types"
import { useBacklinks, useImportBacklinks } from "../hooks/use-seo"
import { exportBacklinks } from "../lib/seo-export"

// =============================================================================
// Off-page / backlinks (plan step 8). Ahrefs Webmaster Tools & Search Console
// have no free API, so a human pastes the export here and we diff it: new
// referring domains are counted (and feed the scorecard), vanished links are
// marked lost. The value is the monthly trend, not a live crawl.
// =============================================================================

const num = (v: number) => v.toLocaleString("en-IN")

export function BacklinksPanel({
  projectId,
  propertyId,
  siteLabel = "site",
  canManage,
}: {
  projectId: string
  propertyId: string | null
  siteLabel?: string
  canManage: boolean
}) {
  const { data, isLoading } = useBacklinks(projectId, propertyId)
  const importer = useImportBacklinks(projectId)

  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [source, setSource] = useState<"AWT" | "GSC" | "MANUAL">("AWT")
  const [fullSnapshot, setFullSnapshot] = useState(true)

  if (isLoading) return <ListSkeleton />

  const submit = () => {
    if (!text.trim() || !propertyId) return
    importer.mutate(
      { propertyId, text, source, fullSnapshot },
      {
        onSuccess: () => {
          setText("")
          setOpen(false)
        },
      },
    )
  }

  const has = (data?.referringDomains ?? 0) > 0 || (data?.totalActive ?? 0) > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {data?.lastImportAt
            ? `Last import ${new Date(data.lastImportAt).toLocaleString("en-IN")}`
            : "No backlinks imported yet"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => data && exportBacklinks(data, siteLabel)}
            disabled={!has}
            title={has ? "Download as CSV" : "Nothing to export yet"}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export
          </Button>
          {canManage && (
            <Button
              size="sm"
              variant={open ? "secondary" : "default"}
              onClick={() => setOpen((v) => !v)}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              {open ? "Close" : "Import export"}
            </Button>
          )}
        </div>
      </div>

      {open && canManage && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div>
              <p className="text-sm font-medium">Paste your backlink export</p>
              <p className="text-muted-foreground text-xs">
                From Ahrefs Webmaster Tools or Search Console → Links → export. One source URL per
                line, or CSV columns <code>source, anchor, target, DR</code>.
              </p>
            </div>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                "https://example.com/blog/post-linking-to-us\nhttps://another.com/resources, great tool, https://oursite.com/, 42"
              }
              className="min-h-[140px] font-mono text-xs"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AWT">Ahrefs Webmaster Tools</SelectItem>
                  <SelectItem value="GSC">Search Console</SelectItem>
                  <SelectItem value="MANUAL">Manual / other</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={fullSnapshot}
                  onCheckedChange={(v) => setFullSnapshot(v === true)}
                />
                This is the complete current list (mark vanished links as lost)
              </label>
              <Button size="sm" onClick={submit} disabled={importer.isPending || !text.trim()}>
                {importer.isPending ? "Importing…" : "Import & diff"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!has ? (
        <EmptyState
          icon={Link2}
          title="No backlinks yet"
          description={
            canManage
              ? "Import an Ahrefs Webmaster Tools or Search Console links export to track referring domains. Re-import monthly - the diff shows what you gained and lost, and the referring-domain count feeds the scorecard."
              : "A project manager needs to import a backlink export first."
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Referring domains" value={data!.referringDomains} />
            <Stat label="Active links" value={data!.totalActive} />
            <Stat label="New domains (28d)" value={data!.newDomains28d} tone="accent" />
            <Stat
              label="Lost links"
              value={data!.totalLost}
              tone={data!.totalLost > 0 ? "muted" : "default"}
            />
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="border-border border-b px-4 py-3">
                <p className="text-sm font-medium">Referring domains</p>
                <p className="text-muted-foreground text-xs">
                  Highest authority first. These are your outreach relationships worth protecting.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground border-border border-b text-xs">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Domain</th>
                      <th className="px-4 py-2 text-right font-medium">Links</th>
                      <th className="px-4 py-2 text-right font-medium">DR</th>
                      <th className="px-4 py-2 text-right font-medium">First seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.domains.map((d) => (
                      <tr key={d.domain} className="border-border/60 border-b last:border-0">
                        <td className="px-4 py-2">
                          <a
                            href={`https://${d.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium hover:underline"
                          >
                            {d.domain}
                          </a>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{num(d.links)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {d.domainRating !== null ? (
                            <Badge variant="outline" className="text-[10px]">
                              {d.domainRating}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="text-muted-foreground px-4 py-2 text-right text-xs">
                          {new Date(d.firstSeen).toLocaleDateString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: number
  tone?: "default" | "accent" | "muted"
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p
          className={
            tone === "accent"
              ? "text-primary text-2xl font-semibold"
              : tone === "muted"
                ? "text-muted-foreground text-2xl font-semibold"
                : "text-2xl font-semibold"
          }
        >
          {num(value)}
        </p>
      </CardContent>
    </Card>
  )
}
