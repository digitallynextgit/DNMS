"use client"

import { useState } from "react"
import { AlertTriangle, Check, Copy, FileText, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useAnalyseBrandDocs } from "../hooks/use-brand-ai"

export interface BriefDocument {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
}

/** Mirrors lib/file-text's isExtractable (server-only) so the list can flag an
 *  unreadable file before a round trip rather than after. */
function looksReadable(mimeType: string, fileName: string): boolean {
  const n = fileName.toLowerCase()
  return (
    mimeType.includes("pdf") ||
    mimeType.includes("word") ||
    mimeType.includes("officedocument.wordprocessing") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.startsWith("text/") ||
    /\.(pdf|docx|doc|xlsx|xls|csv|txt|md|json)$/.test(n)
  )
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

interface BodyProps {
  projectId: string
  documents: BriefDocument[]
  /** Whether the brief field already has text - decides Replace vs Use wording. */
  hasCurrentBrief: boolean
  onApply: (text: string, mode: "replace" | "append") => void
  onClose: () => void
}

/**
 * "Draft with AI" for the brand brief: pick which uploaded documents to read,
 * get a drafted brief + recommendations + open questions, then push the draft
 * into the brief field. The field's own Save button is still the only thing
 * that persists it.
 */
export function BrandAiDialog({
  open,
  onOpenChange,
  ...body
}: Omit<BodyProps, "onClose"> & {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        {/* State lives in a child that only exists while open, so each opening
            starts fresh (selection + result) without an effect. */}
        <Body {...body} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function Body({ projectId, documents, hasCurrentBrief, onApply, onClose }: BodyProps) {
  const analyse = useAnalyseBrandDocs(projectId)
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(documents.filter((d) => looksReadable(d.mimeType, d.fileName)).map((d) => d.id)),
  )
  const result = analyse.data ?? null

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  function apply(mode: "replace" | "append") {
    if (!result) return
    onApply(result.brief, mode)
    toast.success("Draft added to the brief - review it and press Save")
    onClose()
  }

  async function copyAll() {
    if (!result) return
    const parts = [result.brief]
    if (result.recommendations.length) {
      parts.push("## Recommendations\n" + result.recommendations.map((r) => `- ${r}`).join("\n"))
    }
    if (result.gaps.length) {
      parts.push("## Questions for the client\n" + result.gaps.map((g) => `- ${g}`).join("\n"))
    }
    try {
      await navigator.clipboard.writeText(parts.join("\n\n"))
      toast.success("Copied")
    } catch {
      toast.error("Could not copy - your browser blocked clipboard access.")
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" /> Draft the brand brief with AI
        </DialogTitle>
        <DialogDescription>
          Reads the selected documents and drafts a detailed brief, recommendations for the
          strategy, and the questions still open for the client. Nothing is saved until you apply it
          and press Save.
        </DialogDescription>
      </DialogHeader>

      {!result ? (
        <div className="space-y-3">
          <p className="text-xs font-medium">Documents to read</p>
          <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-sm border p-1.5">
            {documents.map((d) => {
              const ok = looksReadable(d.mimeType, d.fileName)
              return (
                <label
                  key={d.id}
                  className={cn(
                    "hover:bg-muted/50 flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm",
                    !ok && "cursor-not-allowed opacity-60",
                  )}
                >
                  <Checkbox
                    checked={selected.has(d.id)}
                    disabled={!ok}
                    onCheckedChange={() => toggle(d.id)}
                    aria-label={`Include ${d.fileName}`}
                  />
                  <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate" title={d.fileName}>
                    {d.fileName}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {ok ? fmtBytes(d.fileSize) : "not readable"}
                  </span>
                </label>
              )
            })}
            {documents.length === 0 && (
              <p className="text-muted-foreground px-2 py-3 text-sm">
                Upload brief documents first (PDF, Word, Excel/CSV or text).
              </p>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            PDFs must contain real text - a scanned page without OCR cannot be read. Images and
            design files are skipped.
          </p>
        </div>
      ) : (
        <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          <Section title="Draft brief">
            <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap">
              {result.brief}
            </pre>
          </Section>
          {result.recommendations.length > 0 && (
            <Section title="Recommendations">
              <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
                {result.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ol>
            </Section>
          )}
          {result.gaps.length > 0 && (
            <Section title="Questions for the client">
              <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                {result.gaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </Section>
          )}
          <Section title="Sources">
            <ul className="flex flex-wrap gap-1.5">
              {result.sources.map((s) => (
                <li
                  key={s.id}
                  title={s.reason}
                  className={cn(
                    "inline-flex max-w-full items-center gap-1 rounded-sm border px-2 py-0.5 text-xs",
                    s.status === "read"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                  )}
                >
                  {s.status === "read" ? (
                    <Check className="h-3 w-3 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                  )}
                  <span className="truncate">{s.fileName}</span>
                  <span className="shrink-0 opacity-70">
                    {s.status === "read"
                      ? `· ${Math.max(1, Math.round(s.chars / 1000))}k chars`
                      : "· skipped"}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      )}

      <DialogFooter className="gap-2 sm:justify-between">
        {!result ? (
          <>
            <span className="text-muted-foreground self-center text-xs">
              {selected.size} of {documents.length} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                disabled={selected.size === 0}
                loading={analyse.isPending}
                onClick={() => analyse.mutate([...selected])}
              >
                {analyse.isPending
                  ? "Reading & drafting… (up to a minute)"
                  : `Analyse ${selected.size} ${selected.size === 1 ? "document" : "documents"}`}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => analyse.reset()}>
                Back
              </Button>
              <Button variant="outline" onClick={() => void copyAll()}>
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
              </Button>
            </div>
            <div className="flex gap-2">
              {hasCurrentBrief && (
                <Button variant="outline" onClick={() => apply("append")}>
                  Append to brief
                </Button>
              )}
              <Button onClick={() => apply("replace")}>
                {hasCurrentBrief ? "Replace brief" : "Use as brief"}
              </Button>
            </div>
          </>
        )}
      </DialogFooter>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h4 className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
        {title}
      </h4>
      <div className="rounded-sm border p-3">{children}</div>
    </section>
  )
}
