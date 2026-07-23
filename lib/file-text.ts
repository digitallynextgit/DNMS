import "server-only"

import { downloadFile } from "@/lib/storage"

// =============================================================================
// Extract plain text from a stored file so the AI assistant can answer from it.
// Supports the common formats (PDF, Word, Excel/CSV, plain text/markdown/JSON).
// Everything is bounded: only files under MAX_BYTES are fetched, and the returned
// text is capped so a big document can't blow the model's context window.
// =============================================================================

const MAX_BYTES = 8 * 1024 * 1024 // 8 MB - skip anything larger
const MAX_CHARS = 6000 // per-file text cap fed to the model

function clean(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_CHARS)
}

/** Which file types we can turn into text. Used to pre-filter before downloading. */
export function isExtractable(mimeType: string, fileName: string): boolean {
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

/**
 * Download a stored file and return its extracted text (capped). Returns null on
 * anything we can't read - never throws, since the AI flow must not fail because
 * one file couldn't be parsed.
 */
export async function extractFileText(input: {
  objectKey: string
  mimeType: string
  fileName: string
  fileSize?: number
}): Promise<string | null> {
  const { objectKey, mimeType, fileName, fileSize } = input
  if (fileSize && fileSize > MAX_BYTES) return null
  if (!isExtractable(mimeType, fileName)) return null

  try {
    const buffer = await downloadFile(objectKey)
    if (buffer.byteLength > MAX_BYTES) return null
    const n = fileName.toLowerCase()

    if (mimeType.includes("pdf") || n.endsWith(".pdf")) {
      const { PDFParse } = await import("pdf-parse")
      const parser = new PDFParse({ data: new Uint8Array(buffer) })
      const out = await parser.getText()
      return clean(out.text)
    }

    if (mimeType.includes("word") || n.endsWith(".docx")) {
      const mammoth = await import("mammoth")
      const out = await mammoth.extractRawText({ buffer })
      return clean(out.value)
    }

    if (
      mimeType.includes("spreadsheet") ||
      mimeType.includes("excel") ||
      /\.(xlsx|xls|csv)$/.test(n)
    ) {
      const XLSX = await import("xlsx")
      const wb = XLSX.read(buffer, { type: "buffer" })
      const parts: string[] = []
      for (const sheetName of wb.SheetNames.slice(0, 10)) {
        const sheet = wb.Sheets[sheetName]
        if (!sheet) continue
        parts.push(`# ${sheetName}\n${XLSX.utils.sheet_to_csv(sheet)}`)
      }
      return clean(parts.join("\n\n"))
    }

    // Plain text / markdown / json / csv-as-text.
    return clean(buffer.toString("utf8"))
  } catch (err) {
    console.error("[file-text] extract failed:", fileName, err)
    return null
  }
}
