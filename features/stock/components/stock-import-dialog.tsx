"use client"

import { useRef, useState } from "react"
import { Upload, FileSpreadsheet, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { parseStockWorkbook, type ParsedImport } from "../lib/parse"
import { useImportStock } from "../hooks/use-stock"

/**
 * HR uploads the stock workbook here. The file is parsed IN THE BROWSER (same
 * pattern as the project sheet importer) and plain JSON goes to the API, which
 * matches holders to employees - including deactivated ones - and leaves
 * anyone it cannot match as a free-text holder HR can link later.
 *
 * Two sheet shapes are understood (both appear in stock.xlsx):
 *   "Given to | On date | <item> | <item> ..."  → issuance rows
 *   "Item | Price per piece | Quantity | ..."   → catalogue / restock rows
 */
export function StockImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedImport | null>(null)
  const importStock = useImportStock()

  async function onFile(file: File) {
    try {
      const XLSX = await import("xlsx")
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true })
      const sheets = wb.SheetNames.map((name) => {
        const ws = wb.Sheets[name]
        const rows = ws
          ? XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(ws, {
              header: 1,
              raw: true,
              defval: null,
              blankrows: false,
            })
          : []
        return { name, rows: rows.map((r) => (Array.isArray(r) ? r : [])) }
      })
      const result = parseStockWorkbook(sheets)
      if (result.items.length === 0 && result.issues.length === 0) {
        toast.error("No stock rows found - expected 'Given to' or 'Item' headers.")
        return
      }
      setFileName(file.name)
      setParsed(result)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read that file")
    }
  }

  function reset() {
    setParsed(null)
    setFileName(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  async function onConfirm() {
    if (!parsed) return
    try {
      const result = await importStock.mutateAsync({
        items: parsed.items,
        issues: parsed.issues,
      })
      toast.success(
        `Imported ${result.issuesCreated} issue(s) - ${result.linked} linked to employees, ` +
          `${result.unlinked} kept as names. Items: ${result.itemsCreated} new, ${result.itemsRestocked} restocked.`,
      )
      reset()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed")
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import stock from Excel</DialogTitle>
          <DialogDescription>
            Upload the stock workbook (.xlsx). Holder names are matched to employees - active or
            deactivated - and unmatched names are kept as-is for linking later.
          </DialogDescription>
        </DialogHeader>

        {!parsed ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="border-border hover:bg-muted/40 flex flex-col items-center gap-2 rounded-sm border border-dashed px-6 py-10 text-center transition-colors"
          >
            <Upload className="text-muted-foreground h-6 w-6" />
            <span className="text-sm font-medium">Choose a .xlsx file</span>
            <span className="text-muted-foreground text-xs">
              Sheets with &quot;Given to&quot; (issues) or &quot;Item&quot; (catalogue) headers
            </span>
          </button>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="text-muted-foreground h-4 w-4 shrink-0" />
              <span className="truncate font-medium">{fileName}</span>
            </div>
            <ul className="text-muted-foreground list-inside list-disc space-y-1">
              <li>
                {parsed.issues.length} issue row(s) across{" "}
                {new Set(parsed.issues.map((r) => r.holderName)).size} holder(s)
              </li>
              <li>{parsed.items.length} catalogue row(s)</li>
              {parsed.skipped.map((s) => (
                <li key={s}>Skipped - {s}</li>
              ))}
            </ul>
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              Importing APPENDS to the register (it is a ledger). Uploading the same file twice
              records everything twice.
            </p>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onFile(f)
          }}
        />

        <DialogFooter>
          {parsed && (
            <Button variant="outline" onClick={reset} disabled={importStock.isPending}>
              Pick another file
            </Button>
          )}
          <Button
            onClick={onConfirm}
            disabled={!parsed || importStock.isPending}
            loading={importStock.isPending}
          >
            {importStock.isPending ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
