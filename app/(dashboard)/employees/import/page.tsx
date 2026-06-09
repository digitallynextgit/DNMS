"use client"

import { useState, useRef } from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  FileText,
  Download,
  ChevronLeft,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ImportResult {
  row: number
  ok: boolean
  error?: string
  name?: string
}

async function send(file: File, preview: boolean) {
  const fd = new FormData()
  fd.append("file", file)
  fd.append("preview", String(preview))
  const res = await fetch("/api/employees/import", { method: "POST", body: fd })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed" }))
    throw new Error(err.error || "Failed")
  }
  return res.json() as Promise<{
    total: number
    valid: number
    imported: number
    results: ImportResult[]
  }>
}

function downloadTemplate() {
  const csv =
    "first_name,last_name,email,employee_code,phone,department,designation,date_of_joining\n" +
    "Asha,Rao,asha@example.com,201,9000000000,Web Development,Web Developer,2026-04-01"
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "employee_import_template.csv"
  a.click()
  URL.revokeObjectURL(url)
}

export default function EmployeeImportPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<{
    valid: number
    total: number
    results: ImportResult[]
  } | null>(null)
  const [done, setDone] = useState<{ imported: number; total: number } | null>(null)

  const previewMut = useMutation({
    mutationFn: (f: File) => send(f, true),
    onSuccess: (d) => setPreview({ valid: d.valid, total: d.total, results: d.results }),
    onError: (e: Error) => toast.error(e.message),
  })
  const importMut = useMutation({
    mutationFn: (f: File) => send(f, false),
    onSuccess: (d) => {
      setDone({ imported: d.imported, total: d.total })
      toast.success(`Imported ${d.imported} of ${d.total} employees`)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function handleFile(f: File) {
    setFile(f)
    setPreview(null)
    setDone(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk Import Employees"
        description="Create many employees at once from a CSV file"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
              <Download className="h-4 w-4" /> Template
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/employees" className="flex items-center gap-1.5">
                <ChevronLeft className="h-4 w-4" /> Back
              </Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">CSV columns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted rounded p-3 font-mono text-[11px] leading-5">
            first_name, last_name, email (required) · employee_code, phone, department, designation,
            date_of_joining (optional)
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Department/designation are matched by name. New employees get the default password
            Admin@123 and the Employee role. Codes auto-generate if blank.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div
            className="hover:border-primary/50 border-muted-foreground/25 cursor-pointer rounded border-2 border-dashed p-8 text-center transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="text-muted-foreground mx-auto mb-3 h-8 w-8" />
            <p className="text-sm font-medium">{file?.name || "Click to upload a CSV file"}</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />

          {file && !done && (
            <div className="mt-4 flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => previewMut.mutate(file)}
                disabled={previewMut.isPending}
              >
                {previewMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <FileText className="mr-2 h-4 w-4" /> Validate
              </Button>
              {preview && preview.valid > 0 && (
                <Button onClick={() => importMut.mutate(file)} disabled={importMut.isPending}>
                  {importMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Import {preview.valid} employees
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {done && (
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            <p className="text-sm">
              <span className="font-medium">Import complete.</span> {done.imported} of {done.total}{" "}
              employees created.
            </p>
          </CardContent>
        </Card>
      )}

      {preview && !done && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {preview.valid}/{preview.total} rows valid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b">
                    <th className="text-muted-foreground px-3 py-2 text-left font-medium">Row</th>
                    <th className="text-muted-foreground px-3 py-2 text-left font-medium">Name</th>
                    <th className="text-muted-foreground px-3 py-2 text-left font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.results.slice(0, 100).map((r) => (
                    <tr key={r.row} className={r.ok ? "" : "bg-red-50 dark:bg-red-950/20"}>
                      <td className="text-muted-foreground px-3 py-2">{r.row}</td>
                      <td className="px-3 py-2">{r.name}</td>
                      <td className="px-3 py-2">
                        {r.ok ? (
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
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
