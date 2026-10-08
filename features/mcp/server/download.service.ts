import "server-only"

import { publicOrigin } from "./config"
import { describeEndpoint, invokeRoute } from "./api-dispatch"
import {
  LINK_TTL_MS,
  MAX_FILE_BYTES,
  holdFile,
  linkUrl,
  newNonce,
  signLink,
  type LinkPayload,
} from "./download-links"
import type { Principal } from "./principal"
import { fetchPublicCapped } from "./safe-fetch"
import {
  contentTypeFromName,
  fileNameFromDisposition,
  findSignedUrl,
  flattenRows,
  guardCsvCell,
  looksLikePresignedStorageUrl,
  paginationOf,
  pickRows,
  safeFileName,
  signedUrlExpiry,
  withExtension,
} from "../lib/download-utils"
import { extractTextFromBuffer, isExtractable } from "@/lib/file-text"
import { toCsv } from "@/lib/export-csv"

// dnms_download / dnms_export_table. Every download runs the real route as the person. Result:
// a generated file (held 10 min behind a signed link), a signed storage link, or CSV/Excel built
// from a list endpoint's rows.

export interface FileOutcome {
  ok: boolean
  status: number
  route?: string
  note?: string
  file?: {
    fileName: string
    contentType: string
    sizeBytes?: number
    /** Open this to download. */
    link: string
    /** ISO time the link stops working (best known). */
    expiresAt: string | null
    /** How the link is served. */
    source: "dnms-generated" | "storage-link" | "external-link" | "table-export"
  }
  /** Extracted text, when asked for and possible. */
  text?: string
  textNote?: string
  /** table-export only */
  table?: { rows: number; columns: string[]; truncated: boolean }
}

const MAX_TEXT_CHARS = 12_000
const MAX_TEXT_FETCH_BYTES = 8 * 1024 * 1024

export interface DownloadInput {
  path: string
  query?: Record<string, unknown>
  method?: "GET" | "POST"
  body?: unknown
  readText?: boolean
}

/** "/api/x" + {a:1} → "/api/x?a=1" (keeps any query already on the path). */
function buildPath(path: string, query?: Record<string, unknown>): string {
  const url = new URL(path.trim(), publicOrigin())
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === null || v === "") continue
    if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(k, String(item)))
    else url.searchParams.set(k, typeof v === "object" ? JSON.stringify(v) : String(v))
  }
  return url.pathname + url.search
}

/** Does the route itself offer ?download=1 (sign for a save instead of a preview)? */
function supportsDownloadParam(pathname: string, method: string): boolean {
  const ep = describeEndpoint(pathname)
  return !!ep?.methods[method as "GET" | "POST"]?.query?.includes("download")
}

type Captured =
  | { kind: "file"; bytes: Uint8Array; contentType: string; fileName: string }
  | { kind: "link"; url: string; fileName: string | null }
  | { kind: "error"; outcome: FileOutcome }

/** Read a route's Response and decide what it is. */
async function capture(
  res: Response,
  route: string,
  pathname: string,
  hop = 0,
  principal?: Principal,
): Promise<Captured> {
  const status = res.status
  const type = (res.headers.get("content-type") ?? "").toLowerCase()
  const fail = (note: string, st = status): Captured => ({
    kind: "error",
    outcome: { ok: false, status: st, route, note },
  })

  // A redirect to a signed storage link (CVs, chat and gallery files, attachments).
  if (status >= 300 && status < 400) {
    await res.body?.cancel().catch(() => {})
    const location = res.headers.get("location")
    if (!location) return fail("The endpoint redirected without saying where.")
    const target = new URL(location, publicOrigin())
    // Our own origin is another DNMS route: follow it once, as the same person.
    if (target.origin === publicOrigin() && principal && hop < 1) {
      const next = await invokeRoute(principal, {
        method: "GET",
        path: target.pathname + target.search,
      })
      if (!next.ok) return { kind: "error", outcome: next.result }
      return capture(next.value.res, next.value.route, target.pathname, hop + 1, principal)
    }
    if (target.protocol !== "https:" && target.protocol !== "http:") {
      return fail("The endpoint redirected to something that is not a web link.")
    }
    return { kind: "link", url: target.toString(), fileName: null }
  }

  if (status < 200 || status >= 300) {
    const text = (await res.text().catch(() => "")).slice(0, 2000)
    let message = text
    try {
      const j = JSON.parse(text) as { error?: string | { message?: string }; message?: string }
      message = typeof j.error === "string" ? j.error : (j.error?.message ?? j.message ?? text)
    } catch {
      /* keep the raw text */
    }
    return fail(message || `The endpoint answered ${status}.`)
  }

  // JSON: either data, or data holding a signed link to the file.
  if (type.includes("application/json")) {
    const json = await res.json().catch(() => null)
    const found = findSignedUrl(json)
    if (found) return { kind: "link", url: found.url, fileName: found.name }
    return fail(
      "This endpoint returns data, not a file. Use dnms_get to read it, or dnms_export_table to get it as a spreadsheet.",
      422,
    )
  }

  // Anything else is the file itself.
  const declared = Number(res.headers.get("content-length") ?? 0)
  if (declared > MAX_FILE_BYTES) {
    await res.body?.cancel().catch(() => {})
    return fail(`The file is larger than ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB.`, 413)
  }
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.byteLength > MAX_FILE_BYTES) {
    return fail(`The file is larger than ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB.`, 413)
  }
  const contentType = type.split(";")[0]!.trim() || "application/octet-stream"
  const proposed =
    fileNameFromDisposition(res.headers.get("content-disposition")) ??
    safeFileName(pathname.split("/").filter(Boolean).pop(), "download")
  return { kind: "file", bytes, contentType, fileName: withExtension(proposed, contentType) }
}

/** Issue a signed link for bytes we are holding. */
function issueLink(
  principal: Principal,
  file: { bytes: Uint8Array; contentType: string; fileName: string },
  rebuildPath: string,
  method: "GET" | "POST",
): NonNullable<FileOutcome["file"]> {
  const nonce = newNonce()
  holdFile(nonce, {
    bytes: file.bytes,
    contentType: file.contentType,
    fileName: file.fileName,
    grantId: principal.grantId,
  })
  const expires = Date.now() + LINK_TTL_MS
  const payload: LinkPayload = {
    g: principal.grantId,
    n: nonce,
    e: expires,
    m: method,
    p: rebuildPath,
    f: file.fileName,
    t: file.contentType,
  }
  return {
    fileName: file.fileName,
    contentType: file.contentType,
    sizeBytes: file.bytes.byteLength,
    link: linkUrl(signLink(payload)),
    expiresAt: new Date(expires).toISOString(),
    source: rebuildPath ? "dnms-generated" : "table-export",
  }
}

async function textOf(
  bytes: Uint8Array,
  contentType: string,
  fileName: string,
): Promise<Pick<FileOutcome, "text" | "textNote">> {
  if (!isExtractable(contentType, fileName)) {
    return { textNote: `Reading the text of ${contentType || "this file type"} is not supported.` }
  }
  try {
    const text = await extractTextFromBuffer(
      Buffer.from(bytes),
      contentType,
      fileName,
      MAX_TEXT_CHARS,
    )
    return text
      ? { text }
      : { textNote: "The file has no readable text (it may be scanned images)." }
  } catch (err) {
    console.error("[mcp] text extraction failed", fileName, err)
    return { textNote: "The file's text could not be read." }
  }
}

export async function prepareDownload(
  principal: Principal,
  input: DownloadInput,
): Promise<FileOutcome> {
  const method = input.method ?? "GET"
  const pathname = new URL(input.path.trim(), publicOrigin()).pathname.replace(/\/+$/, "")
  const query = { ...(input.query ?? {}) }
  const hasDownloadInPath = /[?&]download=/.test(input.path)
  if (
    query.download === undefined &&
    !hasDownloadInPath &&
    supportsDownloadParam(pathname, method)
  ) {
    query.download = "1"
  }
  const full = buildPath(input.path, query)

  const run = await invokeRoute(principal, { method, path: full, body: input.body })
  if (!run.ok) return run.result

  const got = await capture(run.value.res, run.value.route, pathname, 0, principal)
  if (got.kind === "error") return got.outcome
  const route = run.value.route

  if (got.kind === "file") {
    const file = issueLink(principal, got, method === "GET" ? full : "", method)
    return {
      ok: true,
      status: 200,
      route,
      file,
      ...(input.readText ? await textOf(got.bytes, got.contentType, got.fileName) : {}),
    }
  }

  // A signed storage / external link handed back by DNMS itself.
  const expiry = signedUrlExpiry(got.url)
  const presigned = looksLikePresignedStorageUrl(got.url)
  const host = new URL(got.url).hostname
  const signed = new URL(got.url)
  // A presigned link's response-content-disposition has the real name; the key is a fallback.
  const fileName =
    (got.fileName && safeFileName(got.fileName)) ||
    fileNameFromDisposition(signed.searchParams.get("response-content-disposition")) ||
    safeFileName(decodeURIComponent(signed.pathname.split("/").pop() ?? ""), "download")
  const outcome: FileOutcome = {
    ok: true,
    status: 200,
    route,
    file: {
      fileName,
      contentType: contentTypeFromName(fileName),
      link: got.url,
      expiresAt: expiry ? expiry.toISOString() : null,
      source: presigned || /backblazeb2\.com$/.test(host) ? "storage-link" : "external-link",
    },
  }
  if (input.readText) {
    if (!presigned) {
      outcome.textNote = "Only DNMS-stored files can be read; this is an external link."
    } else if (!isExtractable("", fileName)) {
      outcome.textNote = "Reading the text of this file type is not supported."
    } else {
      try {
        const fetched = await fetchPublicCapped(got.url, MAX_TEXT_FETCH_BYTES)
        const type = fetched.headers.get("content-type") ?? ""
        Object.assign(outcome, await textOf(fetched.bytes, type, fileName))
        if (outcome.file) {
          outcome.file.contentType = type.split(";")[0]!.trim()
          outcome.file.sizeBytes = fetched.bytes.byteLength
        }
      } catch {
        outcome.textNote = "The file could not be fetched to read it (it may be larger than 8 MB)."
      }
    }
  }
  return outcome
}

/** Rebuild a GET file whose cached copy is gone (restart), re-running the route as the person. */
export async function rebuildFile(
  principal: Principal,
  path: string,
): Promise<{ bytes: Uint8Array; contentType: string; fileName: string } | null> {
  if (!path) return null
  const run = await invokeRoute(principal, { method: "GET", path })
  if (!run.ok) return null
  const got = await capture(run.value.res, run.value.route, new URL(path, publicOrigin()).pathname)
  return got.kind === "file" ? got : null
}

export interface ExportInput {
  path: string
  query?: Record<string, unknown>
  format?: "xlsx" | "csv"
  fileName?: string
  maxRows?: number
}

const MAX_EXPORT_ROWS = 10_000
const PAGE_SIZE = 100
const MAX_PAGES = 100

export async function exportTable(principal: Principal, input: ExportInput): Promise<FileOutcome> {
  const format = input.format ?? "xlsx"
  const maxRows = Math.min(Math.max(input.maxRows ?? 2000, 1), MAX_EXPORT_ROWS)
  const pathname = new URL(input.path.trim(), publicOrigin()).pathname.replace(/\/+$/, "")
  const ep = describeEndpoint(pathname)
  const supports = ep?.methods.GET?.query ?? []

  const baseQuery: Record<string, unknown> = { ...(input.query ?? {}) }
  if (supports.includes("limit") && baseQuery.limit === undefined) baseQuery.limit = PAGE_SIZE

  const collected: Record<string, unknown>[] = []
  let page = 1
  let totalPages: number | null = null
  let route = ""
  let truncated = false

  for (;;) {
    const query = { ...baseQuery, ...(supports.includes("page") && page > 1 ? { page } : {}) }
    const run = await invokeRoute(principal, { method: "GET", path: buildPath(input.path, query) })
    if (!run.ok) return run.result
    route = run.value.route
    const res = run.value.res
    if (!res.ok) {
      const t = (await res.text().catch(() => "")).slice(0, 500)
      return {
        ok: false,
        status: res.status,
        route,
        note: t || `The endpoint answered ${res.status}.`,
      }
    }
    if (!(res.headers.get("content-type") ?? "").includes("application/json")) {
      await res.body?.cancel().catch(() => {})
      return {
        ok: false,
        status: 422,
        route,
        note: "This endpoint does not return a list. Use dnms_download for files.",
      }
    }
    const json = await res.json().catch(() => null)
    const picked = pickRows(json)
    if (!picked) {
      return page === 1
        ? {
            ok: false,
            status: 422,
            route,
            note: "No list of records was found in this response, so there is nothing to export.",
          }
        : finish()
    }
    collected.push(...picked.rows)
    const p = paginationOf(json)
    totalPages = p.totalPages ?? totalPages
    if (collected.length >= maxRows) {
      truncated = collected.length > maxRows || (p.total !== null && p.total > maxRows)
      collected.length = Math.min(collected.length, maxRows)
      break
    }
    if (
      !supports.includes("page") ||
      totalPages === null ||
      page >= totalPages ||
      page >= MAX_PAGES
    )
      break
    page++
  }
  return finish()

  async function finish(): Promise<FileOutcome> {
    const { columns, rows } = flattenRows(collected)
    const stamp = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10)
    const base = safeFileName(
      input.fileName ?? pathname.split("/").filter(Boolean).slice(1).join("-"),
      "export",
    )
    const fileName = `${base.replace(/\.(csv|xlsx)$/i, "")}-${stamp}.${format}`

    let bytes: Uint8Array
    let contentType: string
    if (format === "csv") {
      const text = toCsv(
        rows.map((r) => r.map(guardCsvCell)),
        columns,
      )
      bytes = new Uint8Array(Buffer.from("﻿" + text, "utf8")) // BOM so Excel reads UTF-8
      contentType = "text/csv"
    } else {
      bytes = await buildXlsx(base, columns, rows)
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }
    if (bytes.byteLength > MAX_FILE_BYTES) {
      return {
        ok: false,
        status: 413,
        route,
        note: "The export is too large. Narrow it with filters.",
      }
    }
    return {
      ok: true,
      status: 200,
      route,
      file: issueLink(principal, { bytes, contentType, fileName }, "", "GET"),
      table: { rows: rows.length, columns: columns.slice(0, 40), truncated },
    }
  }
}

async function buildXlsx(title: string, columns: string[], rows: unknown[][]): Promise<Uint8Array> {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  wb.creator = "DNMS"
  const ws = wb.addWorksheet(
    safeFileName(title)
      .replace(/[[\]:*?/\\]/g, " ")
      .slice(0, 31) || "Export",
    {
      views: [{ state: "frozen", ySplit: 1 }],
    },
  )
  ws.columns = columns.map((header, i) => ({
    header,
    key: `c${i}`,
    width: Math.min(60, Math.max(10, header.length + 2)),
  }))
  ws.getRow(1).font = { bold: true }
  for (const row of rows) {
    ws.addRow(Object.fromEntries(row.map((v, i) => [`c${i}`, v ?? ""])))
  }
  const out = await wb.xlsx.writeBuffer()
  return new Uint8Array(out as ArrayBuffer)
}
