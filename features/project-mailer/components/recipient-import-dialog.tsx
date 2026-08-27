"use client"

/**
 * Spreadsheet import for the recipient list.
 *
 * The file is parsed in the BROWSER, not on the server, for one reason: nobody
 * should find out which column was treated as the email address by receiving
 * bounces. Parse, map, preview, then commit - the server only ever sees rows
 * somebody has looked at.
 *
 * `xlsx` is loaded with a dynamic import so its ~400 KB stays out of the project
 * page bundle until a file is actually chosen.
 */

import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { FileSpreadsheet, Loader2, Upload, X } from "lucide-react"

import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** Mirrors IMPORT_ROW_LIMIT in the schema. */
const ROW_LIMIT = 5000
/** Sentinel for "this column is not mapped" - Radix Select forbids an empty value. */
const NONE = "__none__"

interface Sheet {
  fileName: string
  sheetName: string
  headers: string[]
  rows: Record<string, string>[]
}

interface ImportResult {
  parsed: number
  added: number
  tagged: number
  existing: number
  invalid: number
}

/** Header-name guesses, in priority order. */
function detect(headers: string[], patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const hit = headers.find((h) => p.test(h))
    if (hit) return hit
  }
  return null
}

/** Fallback when no header looks like an email: find the column that IS emails. */
function detectByContent(sheet: Sheet): string | null {
  const sample = sheet.rows.slice(0, 25)
  for (const h of sheet.headers) {
    const values = sample.map((r) => r[h] ?? "").filter((v) => v.trim() !== "")
    if (values.length === 0) continue
    const hits = values.filter((v) => EMAIL_RE.test(v.trim())).length
    if (hits / values.length >= 0.8) return h
  }
  return null
}

export function RecipientImportDialog({
  base,
  open,
  onOpenChange,
  allTags,
  existingEmails,
  knowsWholeList,
  onDone,
}: {
  base: string
  open: boolean
  onOpenChange: (o: boolean) => void
  /** Tags already used on this project, offered as one-click choices. */
  allTags: string[]
  /** Lowercased addresses already on the list, for an honest pre-commit summary. */
  existingEmails: Set<string>
  /**
   * Whether `existingEmails` is the COMPLETE list. The overview loads at most 500
   * recipients, so on a bigger list we cannot tell new from existing here - and
   * we say nothing rather than print a new/existing split that is wrong. The
   * server counts it properly and reports back after the import.
   */
  knowsWholeList: boolean
  onDone: () => void
}) {
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [sheet, setSheet] = React.useState<Sheet | null>(null)
  const [reading, setReading] = React.useState(false)
  const [emailCol, setEmailCol] = React.useState<string>(NONE)
  const [nameCol, setNameCol] = React.useState<string>(NONE)
  const [companyCol, setCompanyCol] = React.useState<string>(NONE)
  const [tags, setTags] = React.useState<string[]>([])
  const [newTag, setNewTag] = React.useState("")
  const [tagExisting, setTagExisting] = React.useState(true)

  const reset = React.useCallback(() => {
    setSheet(null)
    setEmailCol(NONE)
    setNameCol(NONE)
    setCompanyCol(NONE)
    setTags([])
    setNewTag("")
    setTagExisting(true)
    if (fileRef.current) fileRef.current.value = ""
  }, [])

  React.useEffect(() => {
    if (open) reset()
  }, [open, reset])

  async function readFile(file: File) {
    setReading(true)
    try {
      const XLSX = await import("xlsx")
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" })
      const sheetName = wb.SheetNames[0]
      const ws = sheetName ? wb.Sheets[sheetName] : undefined
      if (!sheetName || !ws) throw new Error("That file has no sheets in it")

      // `raw: false` so a number-formatted cell arrives as the text you SEE in
      // Excel; header:1 keeps blank and duplicate headers visible instead of
      // silently collapsing them into one key.
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        blankrows: false,
        raw: false,
        defval: "",
      })
      const headerRow = matrix[0]
      if (!headerRow || headerRow.length === 0) throw new Error("The first sheet is empty")

      const seen = new Map<string, number>()
      const headers = headerRow.map((h, i) => {
        const label = String(h ?? "").trim() || `Column ${i + 1}`
        // Two columns called "Name" would otherwise overwrite each other.
        const n = (seen.get(label) ?? 0) + 1
        seen.set(label, n)
        return n > 1 ? `${label} (${n})` : label
      })

      const rows: Record<string, string>[] = []
      for (const raw of matrix.slice(1)) {
        const arr = Array.isArray(raw) ? raw : []
        const row: Record<string, string> = {}
        let hasValue = false
        headers.forEach((h, i) => {
          const v = String(arr[i] ?? "").trim()
          row[h] = v
          if (v) hasValue = true
        })
        if (hasValue) rows.push(row)
      }
      if (rows.length === 0) throw new Error("The sheet has headers but no data rows")

      const next: Sheet = { fileName: file.name, sheetName, headers, rows }
      setSheet(next)

      // Pre-map what we can. Everything stays editable - a guess that is wrong
      // and invisible is worse than no guess at all.
      setEmailCol(
        detect(headers, [/^e-?mail/i, /e-?mail/i, /^mail$/i]) ?? detectByContent(next) ?? NONE,
      )
      setNameCol(detect(headers, [/^name$/i, /full.?name/i, /^first.?name/i, /name/i]) ?? NONE)
      setCompanyCol(detect(headers, [/company/i, /organi[sz]ation/i, /^org$/i]) ?? NONE)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that file")
      reset()
    } finally {
      setReading(false)
    }
  }

  // Everything the commit needs, plus the counts shown before committing - one
  // derivation so the preview cannot disagree with what actually gets sent.
  const mapped = React.useMemo(() => {
    if (!sheet || emailCol === NONE) return null
    const extraCols = sheet.headers.filter(
      (h) => h !== emailCol && h !== nameCol && h !== companyCol,
    )
    const rows: {
      email: string
      name?: string
      company?: string
      fields: Record<string, string>
    }[] = []
    const seen = new Set<string>()
    let invalid = 0
    let duplicate = 0
    let alreadyOnList = 0

    for (const r of sheet.rows) {
      const email = (r[emailCol] ?? "").trim().toLowerCase()
      if (!EMAIL_RE.test(email)) {
        invalid++
        continue
      }
      if (seen.has(email)) {
        duplicate++
        continue
      }
      seen.add(email)
      if (existingEmails.has(email)) alreadyOnList++
      const fields: Record<string, string> = {}
      for (const c of extraCols) {
        const v = (r[c] ?? "").trim()
        if (v) fields[c] = v
      }
      rows.push({
        email,
        name: nameCol !== NONE ? (r[nameCol] ?? "").trim() || undefined : undefined,
        company: companyCol !== NONE ? (r[companyCol] ?? "").trim() || undefined : undefined,
        fields,
      })
    }
    return {
      rows,
      extraCols,
      invalid,
      duplicate,
      alreadyOnList,
      fresh: rows.length - alreadyOnList,
    }
  }, [sheet, emailCol, nameCol, companyCol, existingEmails])

  const overLimit = (mapped?.rows.length ?? 0) > ROW_LIMIT

  /**
   * Tags as they will actually be sent, INCLUDING whatever is still sitting in
   * the text box.
   *
   * Requiring Enter to "commit" a tag lost 311 recipients' tag on a real import:
   * the word was visibly there in the input, and Import silently ignored it.
   * Typed text that is on screen when you press the button is intent, not a
   * draft - anything else quietly discards what the person told us.
   */
  const effectiveTags = React.useMemo(() => {
    const pending = newTag.trim().replace(/,+$/, "")
    if (!pending || tags.includes(pending)) return tags
    return [...tags, pending]
  }, [tags, newTag])

  const run = useMutation({
    mutationFn: () =>
      apiFetch<{ data: { data: ImportResult } }>(`${base}/recipients/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: mapped?.rows ?? [], tags: effectiveTags, tagExisting }),
      }),
    onSuccess: (res) => {
      const r = res?.data?.data
      const parts: string[] = []
      if (r?.added) parts.push(`${r.added} added`)
      if (r?.tagged) parts.push(`${r.tagged} tagged`)
      if (r?.invalid) parts.push(`${r.invalid} skipped`)
      toast.success(parts.length ? `Import done - ${parts.join(", ")}` : "Import done")
      onOpenChange(false)
      onDone()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function addTag(value: string) {
    const clean = value.trim().replace(/,+$/, "")
    if (!clean) return
    setTags((prev) => (prev.includes(clean) ? prev : [...prev, clean]))
    setNewTag("")
  }

  const unusedTags = allTags.filter((t) => !effectiveTags.includes(t))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl lg:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-sm">Import recipients from a spreadsheet</DialogTitle>
          <DialogDescription className="text-xs">
            .xlsx, .xls or .csv. The first sheet is used. Nothing is saved until you confirm the
            columns below.
          </DialogDescription>
        </DialogHeader>

        {!sheet ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={reading}
            className="hover:border-primary/50 hover:bg-muted/40 flex w-full flex-col items-center gap-2 rounded-sm border border-dashed px-4 py-10 transition-colors"
          >
            {reading ? (
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            ) : (
              <Upload className="text-muted-foreground h-6 w-6" />
            )}
            <span className="text-sm font-medium">
              {reading ? "Reading the file…" : "Choose a spreadsheet"}
            </span>
            <span className="text-muted-foreground text-xs">
              Needs a column of email addresses. Any other column becomes a{" "}
              <span className="font-mono">{"{{variable}}"}</span> you can use in a template.
            </span>
          </button>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted/40 flex flex-wrap items-center gap-2 rounded-sm border px-3 py-2">
              <FileSpreadsheet className="text-muted-foreground h-4 w-4 shrink-0" />
              <span className="truncate text-xs font-medium">{sheet.fileName}</span>
              <span className="text-muted-foreground text-[11px]">
                sheet “{sheet.sheetName}” · {sheet.rows.length} rows · {sheet.headers.length}{" "}
                columns
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground ml-auto h-7 gap-1.5 text-xs"
                onClick={reset}
              >
                <X className="h-3.5 w-3.5" />
                Choose another
              </Button>
            </div>

            {/* ── Column mapping ─────────────────────────────────────────── */}
            <div className="grid gap-3 sm:grid-cols-3">
              <ColumnPicker
                label="Email"
                required
                value={emailCol}
                onChange={setEmailCol}
                headers={sheet.headers}
                allowNone={false}
              />
              <ColumnPicker
                label="Name"
                value={nameCol}
                onChange={setNameCol}
                headers={sheet.headers}
              />
              <ColumnPicker
                label="Company"
                value={companyCol}
                onChange={setCompanyCol}
                headers={sheet.headers}
              />
            </div>

            {mapped && mapped.extraCols.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-muted-foreground text-[11px]">Kept as merge variables:</span>
                {mapped.extraCols.map((c) => (
                  <Badge key={c} variant="outline" className="font-mono text-[10px]">
                    {`{{${c}}}`}
                  </Badge>
                ))}
              </div>
            )}

            {/* ── Tags ───────────────────────────────────────────────────── */}
            <div className="space-y-2">
              <Label className="text-xs">Tag everyone in this file</Label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <Badge key={t} className="gap-1 text-[10px]">
                    {t}
                    <button
                      type="button"
                      aria-label={`Remove tag ${t}`}
                      onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                      className="hover:text-destructive-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {effectiveTags.length === 0 && (
                  <span className="text-muted-foreground text-[11px]">
                    None yet - a tag is how a campaign targets this group later.
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault()
                      addTag(newTag)
                    }
                  }}
                  // Clicking straight to Import blurs this first, so the tag
                  // becomes a chip and what you see matches what is sent.
                  onBlur={() => addTag(newTag)}
                  placeholder="Type a tag"
                  aria-label="Type a tag"
                  className="h-8 max-w-[200px] text-xs"
                />
                {unusedTags.slice(0, 8).map((t) => (
                  <Button
                    key={t}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => addTag(t)}
                  >
                    + {t}
                  </Button>
                ))}
              </div>
              {effectiveTags.length > 0 &&
                (!knowsWholeList || (mapped?.alreadyOnList ?? 0) > 0) && (
                  <label className="flex items-center gap-2 pt-1">
                    <Switch checked={tagExisting} onCheckedChange={setTagExisting} />
                    <span className="text-muted-foreground text-[11px]">
                      {knowsWholeList && mapped
                        ? `Also tag the ${mapped.alreadyOnList} address${
                            mapped.alreadyOnList === 1 ? "" : "es"
                          } already on the list`
                        : "Also tag addresses in this file that are already on the list"}
                    </span>
                  </label>
                )}
            </div>

            {/* ── Preview + counts ───────────────────────────────────────── */}
            {emailCol === NONE ? (
              <p className="text-destructive text-xs">Pick which column holds the email address.</p>
            ) : mapped ? (
              <div className="space-y-2">
                <p className="text-muted-foreground text-[11px]">
                  {knowsWholeList ? (
                    <>
                      <strong className="text-foreground">{mapped.fresh}</strong> new ·{" "}
                      {mapped.alreadyOnList} already on the list
                    </>
                  ) : (
                    <>
                      <strong className="text-foreground">{mapped.rows.length}</strong> to import
                    </>
                  )}
                  {mapped.duplicate > 0 && ` · ${mapped.duplicate} repeated in the file`}
                  {mapped.invalid > 0 && (
                    <>
                      {" · "}
                      <span className="text-destructive">
                        {mapped.invalid} skipped, no valid email
                      </span>
                    </>
                  )}
                </p>
                <div className="overflow-x-auto rounded-sm border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Email</th>
                        <th className="px-3 py-2 text-left font-medium">Name</th>
                        <th className="px-3 py-2 text-left font-medium">Variables</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mapped.rows.slice(0, 5).map((r) => (
                        <tr key={r.email} className="border-t">
                          <td className="px-3 py-2">{r.email}</td>
                          <td className="text-muted-foreground px-3 py-2">{r.name ?? "-"}</td>
                          <td className="text-muted-foreground px-3 py-2">
                            {Object.keys(r.fields).length || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {mapped.rows.length > 5 && (
                    <p className="text-muted-foreground border-t px-3 py-1.5 text-[11px]">
                      + {mapped.rows.length - 5} more
                    </p>
                  )}
                </div>
                {overLimit && (
                  <p className="text-destructive text-[11px]">
                    {mapped.rows.length} rows is over the {ROW_LIMIT} limit for one import - split
                    the file.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          aria-hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void readFile(f)
          }}
        />

        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-9 text-xs" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="h-9 gap-1.5 text-xs"
            disabled={!mapped || mapped.rows.length === 0 || overLimit || run.isPending}
            onClick={() => run.mutate()}
          >
            {run.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {/* Names the tag on the button itself: the one thing that silently
                went missing on a real import is now impossible to not see. */}
            {mapped?.rows.length
              ? `Import ${mapped.rows.length}${
                  effectiveTags.length ? ` as ${effectiveTags.join(", ")}` : " with no tag"
                }`
              : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ColumnPicker({
  label,
  value,
  onChange,
  headers,
  required,
  allowNone = true,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  headers: string[]
  required?: boolean
  allowNone?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          className={cn("h-9 text-xs", value === NONE && required && "border-destructive")}
        >
          <SelectValue placeholder="Not mapped" />
        </SelectTrigger>
        <SelectContent>
          {allowNone && (
            <SelectItem value={NONE} className="text-xs">
              Not mapped
            </SelectItem>
          )}
          {headers.map((h) => (
            <SelectItem key={h} value={h} className="text-xs">
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
