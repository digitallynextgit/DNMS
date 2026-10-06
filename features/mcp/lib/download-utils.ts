// Pure helpers for the AI connector's file downloads (dnms_download /
// dnms_export_table). No framework or server imports: unit-tested in
// download-utils.test.ts.

export type Cell = string | number | boolean | null

// ---------------------------------------------------------------------------
// File names and types
// ---------------------------------------------------------------------------

/** A file name that is safe to put in a header and on a disk. */
export function safeFileName(name: string | null | undefined, fallback = "download"): string {
  const cleaned = (name ?? "")
    .replace(/[\u0000-\u001f\u007f"\\/:*?<>|]+/g, " ")
    // "../.." path parts become bare dot runs - drop them entirely.
    .replace(/(^|\s)\.+(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 120)
    .trim()
  return cleaned || fallback
}

/** The file name a Content-Disposition header proposes, if any. */
export function fileNameFromDisposition(header: string | null | undefined): string | null {
  if (!header) return null
  const star = header.match(/filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/i)
  if (star?.[1]) {
    try {
      return safeFileName(decodeURIComponent(star[1].trim()))
    } catch {
      /* fall through to the plain form */
    }
  }
  const plain = header.match(/filename\s*=\s*"?([^";]+)"?/i)
  if (plain?.[1]) {
    let value = plain[1].trim()
    try {
      value = decodeURIComponent(value)
    } catch {
      /* keep as is */
    }
    return safeFileName(value)
  }
  return null
}

const EXT_BY_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/msword": "doc",
  "application/vnd.ms-excel": "xls",
  "text/csv": "csv",
  "text/plain": "txt",
  "application/zip": "zip",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
}

export function extensionFor(contentType: string): string | null {
  return EXT_BY_TYPE[contentType.split(";")[0]!.trim().toLowerCase()] ?? null
}

/** The content type a file name implies, or "" when unknown. */
export function contentTypeFromName(name: string): string {
  const ext = name.toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1]
  if (!ext) return ""
  const hit = Object.entries(EXT_BY_TYPE).find(
    ([, e]) => e === ext || (ext === "jpeg" && e === "jpg"),
  )
  return hit?.[0] ?? ""
}

/** Make sure a name carries an extension that matches the content type. */
export function withExtension(name: string, contentType: string): string {
  const ext = extensionFor(contentType)
  if (!ext || /\.[A-Za-z0-9]{1,5}$/.test(name)) return name
  return `${name}.${ext}`
}

// ---------------------------------------------------------------------------
// Signed storage links in JSON ({ data: { signedUrl } } and friends)
// ---------------------------------------------------------------------------

const URL_KEYS = ["signedUrl", "downloadUrl", "fileUrl", "url", "link"]
const NAME_KEYS = ["fileName", "filename", "name", "title"]

/** The first https link under a url-ish key, searched a few levels deep. */
export function findSignedUrl(value: unknown): { url: string; name: string | null } | null {
  const visit = (node: unknown, depth: number): { url: string; name: string | null } | null => {
    if (depth > 4 || node === null || typeof node !== "object" || Array.isArray(node)) return null
    const obj = node as Record<string, unknown>
    for (const key of URL_KEYS) {
      const v = obj[key]
      if (typeof v === "string" && /^https?:\/\//i.test(v)) {
        const nameKey = NAME_KEYS.find((k) => typeof obj[k] === "string" && obj[k])
        return { url: v, name: nameKey ? (obj[nameKey] as string) : null }
      }
    }
    for (const v of Object.values(obj)) {
      const found = visit(v, depth + 1)
      if (found) return found
    }
    return null
  }
  return visit(value, 0)
}

/** When a presigned (S3-style) link stops working, if it says. */
export function signedUrlExpiry(url: string): Date | null {
  try {
    const u = new URL(url)
    const date = u.searchParams.get("X-Amz-Date")
    const seconds = Number(u.searchParams.get("X-Amz-Expires"))
    if (date && /^\d{8}T\d{6}Z$/.test(date) && Number.isFinite(seconds) && seconds > 0) {
      const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${date.slice(9, 11)}:${date.slice(11, 13)}:${date.slice(13, 15)}Z`
      return new Date(Date.parse(iso) + seconds * 1000)
    }
    const expires = Number(u.searchParams.get("Expires"))
    if (Number.isFinite(expires) && expires > 1_000_000_000) return new Date(expires * 1000)
  } catch {
    /* not a URL */
  }
  return null
}

/** Has this presigned link got a signature we can fetch server-side? */
export function looksLikePresignedStorageUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return (
      u.protocol === "https:" &&
      (u.searchParams.has("X-Amz-Signature") || u.searchParams.has("Signature"))
    )
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Turning a list response into a table (dnms_export_table)
// ---------------------------------------------------------------------------

type Json = unknown
const isObject = (v: Json): v is Record<string, Json> =>
  v !== null && typeof v === "object" && !Array.isArray(v)

/**
 * The array of records inside an API response - {data:[...]},
 * {data:{data:[...],pagination}}, {items:[...]}, {rows:[...]}, or else the
 * largest array of objects within a few levels.
 */
export function pickRows(json: Json): { rows: Record<string, Json>[]; path: string } | null {
  const rowsAt = (v: Json): Record<string, Json>[] | null =>
    Array.isArray(v) && v.length > 0 && v.every(isObject) ? (v as Record<string, Json>[]) : null

  const preferred: Array<[string, (j: Json) => Json]> = [
    ["data.data", (j) => (isObject(j) && isObject(j.data) ? j.data.data : undefined)],
    ["data.items", (j) => (isObject(j) && isObject(j.data) ? j.data.items : undefined)],
    ["data.rows", (j) => (isObject(j) && isObject(j.data) ? j.data.rows : undefined)],
    ["data", (j) => (isObject(j) ? j.data : undefined)],
    ["items", (j) => (isObject(j) ? j.items : undefined)],
    ["rows", (j) => (isObject(j) ? j.rows : undefined)],
    ["root", (j) => j],
  ]
  for (const [path, get] of preferred) {
    const rows = rowsAt(get(json))
    if (rows) return { rows, path }
  }

  let best: { rows: Record<string, Json>[]; path: string } | null = null
  const visit = (node: Json, path: string, depth: number) => {
    if (depth > 3 || node === null || typeof node !== "object") return
    const rows = rowsAt(node)
    if (rows) {
      if (!best || rows.length > best.rows.length) best = { rows, path }
      return
    }
    if (isObject(node))
      for (const [k, v] of Object.entries(node)) visit(v, path ? `${path}.${k}` : k, depth + 1)
  }
  visit(json, "", 0)
  return best
}

/** Pagination info from the usual places. */
export function paginationOf(json: Json): { totalPages: number | null; total: number | null } {
  const candidates: Json[] = []
  if (isObject(json)) {
    candidates.push(json.pagination, json.meta)
    if (isObject(json.data)) candidates.push(json.data.pagination, json.data.meta)
  }
  for (const c of candidates) {
    if (!isObject(c)) continue
    const totalPages = Number(c.totalPages)
    const total = Number(c.total)
    if (Number.isFinite(totalPages) || Number.isFinite(total)) {
      return {
        totalPages: Number.isFinite(totalPages) ? totalPages : null,
        total: Number.isFinite(total) ? total : null,
      }
    }
  }
  return { totalPages: null, total: null }
}

const MAX_COLUMNS = 80

function flattenInto(out: Record<string, Cell>, prefix: string, value: Json, depth: number) {
  if (value === null || value === undefined) {
    out[prefix] = null
  } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    out[prefix] = value
  } else if (Array.isArray(value)) {
    out[prefix] = value.every(
      (v) => v === null || ["string", "number", "boolean"].includes(typeof v),
    )
      ? value.join("; ")
      : JSON.stringify(value).slice(0, 2000)
  } else if (isObject(value)) {
    if (depth >= 3) {
      out[prefix] = JSON.stringify(value).slice(0, 2000)
      return
    }
    for (const [k, v] of Object.entries(value))
      flattenInto(out, prefix ? `${prefix}.${k}` : k, v, depth + 1)
  }
}

/** Flatten records into a header + rows grid. Nested objects become "a.b" columns. */
export function flattenRows(records: Record<string, Json>[]): {
  columns: string[]
  rows: Cell[][]
} {
  const flat = records.map((r) => {
    const out: Record<string, Cell> = {}
    flattenInto(out, "", r, 0)
    return out
  })
  const columns: string[] = []
  const seen = new Set<string>()
  for (const row of flat) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key) && columns.length < MAX_COLUMNS) {
        seen.add(key)
        columns.push(key)
      }
    }
  }
  return { columns, rows: flat.map((row) => columns.map((c) => row[c] ?? null)) }
}

/**
 * CSV formula-injection guard. A text cell beginning = or @ (or +/- followed by
 * something that is not a number) would be run as a formula by Excel, so it gets
 * a leading apostrophe. Phone numbers (+91 98...) and negatives are left alone.
 */
export function guardCsvCell(value: Cell): Cell {
  if (typeof value !== "string") return value
  if (/^[=@\t\r]/.test(value)) return `'${value}`
  if (/^[+-]/.test(value) && !/^[+-]\s*\d[\d\s().,-]*$/.test(value)) return `'${value}`
  return value
}
