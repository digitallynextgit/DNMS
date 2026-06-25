"use client"

import { useState, useRef } from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Upload, Loader2, CheckCircle2, XCircle, FileText, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { downloadCsv } from "@/lib/export-csv"

interface CsvRow {
  employee_no: string
  date: string
  check_in: string
  check_out: string
}
interface ImportResult {
  row: number
  success: boolean
  error?: string
  employeeNo?: string
}

async function previewImport(
  rows: CsvRow[],
): Promise<{ preview: boolean; results: ImportResult[]; valid: number; total: number }> {
  const res = await fetch("/api/attendance/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows, preview: true }),
  })
  if (!res.ok) throw new Error("Failed")
  return res.json()
}

async function confirmImport(
  rows: CsvRow[],
): Promise<{ imported: number; total: number; results: ImportResult[] }> {
  const res = await fetch("/api/attendance/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows, preview: false }),
  })
  if (!res.ok) throw new Error("Failed")
  return res.json()
}

function downloadTemplate() {
  const csv =
    "employee_no,date,check_in,check_out\nEMP001,2026-04-01,09:00,18:00\nEMP002,2026-04-01,09:30,17:30"
  downloadCsv(csv, "attendance_import_template.csv")
}

export default function AttendanceImportPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<CsvRow[]>([])
  const [fileName, setFileName] = useState("")
  const [preview, setPreview] = useState<{
    results: ImportResult[]
    valid: number
    total: number
  } | null>(null)
  const [importResult, setImportResult] = useState<{ imported: number; total: number } | null>(null)

  const parseMut = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/attendance/import/parse", { method: "POST", body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to read file" }))
        throw new Error(err.error?.message || "Failed to read file")
      }
      return res.json() as Promise<{ rows: CsvRow[] }>
    },
    onSuccess: (data) => {
      setRows(data.rows)
      if (data.rows.length === 0) {
        toast.error("No rows detected - make sure the file has employee, date and time columns")
      }
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleFile = (file: File) => {
    setFileName(file.name)
    setPreview(null)
    setImportResult(null)
    setRows([])
    parseMut.mutate(file)
  }

  const previewMut = useMutation({
    mutationFn: previewImport,
    onSuccess: (data) =>
      setPreview({ results: data.results, valid: data.valid, total: data.total }),
    onError: () => toast.error("Failed to validate CSV"),
  })

  const importMut = useMutation({
    mutationFn: confirmImport,
    onSuccess: (data) => {
      setImportResult({ imported: data.imported, total: data.total })
      toast.success(`Imported ${data.imported} of ${data.total} records`)
    },
    onError: () => toast.error("Import failed"),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Imports"
        description="Import attendance from a CSV or an Excel export (e.g. Hikvision)"
        actions={
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
            <Download className="h-4 w-4" /> Download CSV Template
          </Button>
        }
      />

      {/* Format info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Supported files</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-2 text-xs">
            Upload a <strong>.csv</strong>, <strong>.xlsx</strong> or <strong>.xls</strong> file.
            The <strong>Hikvision monthly &ldquo;Attendance Record&rdquo;</strong> export (employees
            as rows, days 1&ndash;31 as columns) is detected automatically - the month is read from
            its <em>Made Date</em> line and each day&rsquo;s earliest punch becomes check-in, the
            latest check-out.
          </p>
          <p className="text-muted-foreground mb-2 text-xs">
            A simple flat list also works - columns are matched by name (any of these):
          </p>
          <div className="bg-muted rounded p-3 font-mono text-[11px] leading-5">
            employee no / employee id / person id&nbsp;&nbsp;→ employee
            <br />
            date / attendance date&nbsp;&nbsp;→ date
            <br />
            check in / on duty / in time&nbsp;&nbsp;→ check-in
            <br />
            check out / off duty / out time&nbsp;&nbsp;→ check-out
            <br />
            date time / punch time / time&nbsp;&nbsp;→ per-punch (auto in/out)
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Note: rows are matched to staff by <strong>Employee Code</strong>, so the Hikvision
            &ldquo;Employee ID&rdquo; must equal the employee&rsquo;s code in HRMS (e.g. 132, 136).
            Unmatched IDs are skipped and listed in the validation step.
          </p>
        </CardContent>
      </Card>

      {/* Upload area */}
      <Card>
        <CardContent className="p-6">
          <div
            className={cn(
              "hover:border-primary/50 cursor-pointer rounded border-2 border-dashed p-8 text-center transition-colors",
              "border-muted-foreground/25",
            )}
            onClick={() => fileRef.current?.click()}
          >
            {parseMut.isPending ? (
              <Loader2 className="text-muted-foreground mx-auto mb-3 h-8 w-8 animate-spin" />
            ) : (
              <Upload className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
            )}
            <p className="text-sm font-medium">
              {parseMut.isPending
                ? "Reading file…"
                : fileName || "Click to upload a CSV or Excel file"}
            </p>
            {!parseMut.isPending && rows.length > 0 && (
              <p className="text-muted-foreground mt-1 text-xs">{rows.length} rows detected</p>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />

          {rows.length > 0 && !importResult && (
            <div className="mt-4 flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => previewMut.mutate(rows)}
                disabled={previewMut.isPending}
              >
                {previewMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <FileText className="mr-2 h-4 w-4" /> Validate
              </Button>
              {preview && preview.valid > 0 && (
                <Button onClick={() => importMut.mutate(rows)} disabled={importMut.isPending}>
                  {importMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Import {preview.valid} Valid Records
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import result */}
      {importResult && (
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="font-medium">Import Complete</p>
              <p className="text-muted-foreground text-sm">
                {importResult.imported} records imported out of {importResult.total}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation preview */}
      {preview && !importResult && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Validation Results - {preview.valid}/{preview.total} valid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b">
                    <th className="text-muted-foreground px-3 py-2 text-left font-medium">Row</th>
                    <th className="text-muted-foreground px-3 py-2 text-left font-medium">
                      Employee No
                    </th>
                    <th className="text-muted-foreground px-3 py-2 text-left font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.results.slice(0, 50).map((r) => (
                    <tr key={r.row} className={r.success ? "" : "bg-red-50 dark:bg-red-950/20"}>
                      <td className="text-muted-foreground px-3 py-2">{r.row}</td>
                      <td className="px-3 py-2">{r.employeeNo ?? rows[r.row - 1]?.employee_no}</td>
                      <td className="px-3 py-2">
                        {r.success ? (
                          <span className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" /> Valid
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-500">
                            <XCircle className="h-3 w-3" /> {r.error}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.results.length > 50 && (
                <p className="text-muted-foreground p-3 text-xs">
                  Showing first 50 rows of {preview.results.length}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
