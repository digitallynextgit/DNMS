"use client"

import * as React from "react"
import { toast } from "sonner"
import { FileSpreadsheet, Loader2, Upload } from "lucide-react"

import { FormDialog } from "@/components/shared/form-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmployeeCombobox } from "@/features/employees/components/employee-combobox"
import { useImportLeads } from "../hooks/use-sales"

const NONE = "__none__"
const ROW_LIMIT = 2000

/** The lead fields a column can fill, with header-name guesses in priority order. */
const FIELDS = [
  {
    key: "business",
    label: "Business (required)",
    guess: [/^business/i, /^(name|title|place)$/i, /company|hostel|name/i],
  },
  {
    key: "contactName",
    label: "Contact person",
    guess: [/contact.?(person|name)/i, /owner|manager|person/i],
  },
  {
    key: "phone",
    label: "Phone",
    guess: [/phone|mobile|whats.?app/i, /contact.?(no|number)/i, /number/i],
  },
  { key: "email", label: "Email", guess: [/e-?mail/i] },
  { key: "category", label: "Category", guess: [/categor|type/i] },
  { key: "area", label: "Area", guess: [/area|locality|sector|neighbou?rhood/i] },
  { key: "city", label: "City", guess: [/city|town/i] },
  { key: "address", label: "Address", guess: [/address/i] },
  { key: "website", label: "Website", guess: [/website|web.?site|^web$|^url$/i] },
  { key: "mapsUrl", label: "Google Maps link", guess: [/map/i] },
  { key: "rating", label: "Rating", guess: [/rating|stars/i] },
  { key: "reviewsCount", label: "Reviews", guess: [/review/i] },
  { key: "notes", label: "Notes", guess: [/note|comment|remark/i] },
] as const
type FieldKey = (typeof FIELDS)[number]["key"]

interface Parsed {
  fileName: string
  headers: string[]
  rows: Record<string, string>[]
}

function guess(headers: string[], patterns: readonly RegExp[], taken: Set<string>): string {
  for (const p of patterns) {
    const hit = headers.find((h) => !taken.has(h) && p.test(h))
    if (hit) return hit
  }
  return NONE
}

const num = (v: string) => {
  const n = Number(v.replace(/,/g, "").trim())
  return v.trim() !== "" && Number.isFinite(n) ? n : null
}

export function LeadImportDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = React.useState<Parsed | null>(null)
  const [reading, setReading] = React.useState(false)
  const [map, setMap] = React.useState<Record<FieldKey, string>>(
    () => Object.fromEntries(FIELDS.map((f) => [f.key, NONE])) as Record<FieldKey, string>,
  )
  const [assigneeId, setAssigneeId] = React.useState<string | null>(null)
  const importLeads = useImportLeads(projectId)

  async function readFile(file: File) {
    setReading(true)
    try {
      const XLSX = await import("xlsx")
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" })
      const ws = wb.SheetNames[0] ? wb.Sheets[wb.SheetNames[0]] : undefined
      if (!ws) throw new Error("That file has no sheets in it")
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        blankrows: false,
        raw: false,
        defval: "",
      })
      const head = matrix[0]
      if (!head || head.length === 0) throw new Error("The first sheet is empty")
      const seen = new Map<string, number>()
      const headers = head.map((h, i) => {
        const label = String(h ?? "").trim() || `Column ${i + 1}`
        const n = (seen.get(label) ?? 0) + 1
        seen.set(label, n)
        return n > 1 ? `${label} (${n})` : label
      })
      const rows = matrix
        .slice(1)
        .map((raw) => {
          const arr = Array.isArray(raw) ? raw : []
          return Object.fromEntries(headers.map((h, i) => [h, String(arr[i] ?? "").trim()]))
        })
        .filter((r) => Object.values(r).some(Boolean))
      if (rows.length === 0) throw new Error("The sheet has headers but no data rows")
      if (rows.length > ROW_LIMIT) throw new Error(`Import up to ${ROW_LIMIT} rows at a time`)

      // Each column fills one field, first guess wins.
      const taken = new Set<string>()
      const next = {} as Record<FieldKey, string>
      for (const f of FIELDS) {
        const hit = guess(headers, f.guess, taken)
        if (hit !== NONE) taken.add(hit)
        next[f.key] = hit
      }
      setMap(next)
      setParsed({ fileName: file.name, headers, rows })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that file")
      setParsed(null)
      if (fileRef.current) fileRef.current.value = ""
    } finally {
      setReading(false)
    }
  }

  const leads = React.useMemo(() => {
    if (!parsed || map.business === NONE) return []
    const pick = (row: Record<string, string>, key: FieldKey) =>
      map[key] === NONE ? "" : (row[map[key]] ?? "")
    return parsed.rows
      .map((row) => ({
        business: pick(row, "business"),
        contactName: pick(row, "contactName") || null,
        phone: pick(row, "phone") || null,
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pick(row, "email")) ? pick(row, "email") : null,
        category: pick(row, "category") || null,
        area: pick(row, "area") || null,
        city: pick(row, "city") || null,
        address: pick(row, "address") || null,
        website: pick(row, "website") || null,
        mapsUrl: pick(row, "mapsUrl") || null,
        rating: num(pick(row, "rating")),
        reviewsCount: (() => {
          const n = num(pick(row, "reviewsCount"))
          return n === null ? null : Math.max(0, Math.round(n))
        })(),
        notes: pick(row, "notes") || null,
      }))
      .filter((l) => l.business.trim())
      .map((l) => ({
        ...l,
        rating: l.rating !== null && l.rating >= 0 && l.rating <= 5 ? l.rating : null,
      }))
  }, [parsed, map])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (leads.length === 0) return
    importLeads.mutate(
      { rows: leads, assigneeId },
      {
        onSuccess: () => {
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Import leads"
      description="An Excel or CSV file with one lead per row. Leads already here - the same phone, or the same business in the same area - are skipped."
      isPending={importLeads.isPending}
      submitDisabled={leads.length === 0}
      submitLabel={
        leads.length ? `Import ${leads.length} lead${leads.length === 1 ? "" : "s"}` : "Import"
      }
      onSubmit={submit}
    >
      <div className="space-y-4">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void readFile(file)
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="gap-1.5"
          disabled={reading}
          onClick={() => fileRef.current?.click()}
        >
          {reading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : parsed ? (
            <FileSpreadsheet className="h-3.5 w-3.5" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {parsed ? `${parsed.fileName} - ${parsed.rows.length} rows` : "Choose a file"}
        </Button>

        {parsed && (
          <>
            <p className="text-muted-foreground text-xs">
              Which column holds what. We guessed from the headers - change anything that&apos;s wrong.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs">{f.label}</Label>
                  <Select
                    value={map[f.key]}
                    onValueChange={(v) => setMap((m) => ({ ...m, [f.key]: v }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Not in the file</SelectItem>
                      {parsed.headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Assign them all to (optional)</Label>
              <EmployeeCombobox
                value={assigneeId ?? undefined}
                onChange={(id) => setAssigneeId(id ?? null)}
                placeholder="Nobody yet"
              />
            </div>
            {map.business === NONE ? (
              <p className="text-destructive text-sm">Pick the column with the business name.</p>
            ) : (
              <div className="bg-muted/40 rounded-sm border p-2 text-xs">
                <p className="text-muted-foreground mb-1">First rows:</p>
                {leads.slice(0, 3).map((l, i) => (
                  <p key={i} className="truncate">
                    <span className="font-medium">{l.business}</span>
                    {l.area ? ` · ${l.area}` : ""}
                    {l.phone ? ` · ${l.phone}` : ""}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </FormDialog>
  )
}
