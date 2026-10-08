import "server-only"

import { downloadFile } from "@/lib/storage"

// Plain text from a stored file for the AI assistant (PDF, Word, Excel/CSV, text). Size- and length-capped.

const MAX_BYTES = 8 * 1024 * 1024
const MAX_CHARS = 6000 // per-file text cap fed to the model

function clean(text: string, max: number): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max)
}

/** Pre-filter before downloading. */
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

/** Null on anything unreadable - never throws, so one bad file can't fail the AI flow. */
export async function extractFileText(input: {
  objectKey: string
  mimeType: string
  fileName: string
  fileSize?: number
  /** Defaults to MAX_CHARS (chat-sized); single-call analysis flows pass more. */
  maxChars?: number
  /** Receives why a file couldn't be read, so callers don't have to guess. */
  onError?: (reason: string) => void
}): Promise<string | null> {
  const { objectKey, mimeType, fileName, fileSize } = input
  const max = input.maxChars ?? MAX_CHARS
  if (fileSize && fileSize > MAX_BYTES) {
    input.onError?.(`Larger than ${Math.round(MAX_BYTES / 1024 / 1024)} MB`)
    return null
  }
  if (!isExtractable(mimeType, fileName)) {
    input.onError?.("Not a readable document type")
    return null
  }

  try {
    const buffer = await downloadFile(objectKey)
    if (buffer.byteLength > MAX_BYTES) return null
    return await extractTextFromBuffer(buffer, mimeType, fileName, max)
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.error("[file-text] extract failed:", fileName, err)
    input.onError?.(reason.slice(0, 200))
    return null
  }
}

/** For bytes already in hand. Throws on a parse failure. */
export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
  max = MAX_CHARS,
): Promise<string> {
  const n = fileName.toLowerCase()

  if (mimeType.includes("pdf") || n.endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse")
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const out = await parser.getText()
    return clean(out.text, max)
  }

  if (mimeType.includes("word") || n.endsWith(".docx")) {
    const mammoth = await import("mammoth")
    const out = await mammoth.extractRawText({ buffer })
    return clean(out.value, max)
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
    return clean(parts.join("\n\n"), max)
  }

  // Plain text / markdown / json / csv-as-text.
  return clean(buffer.toString("utf8"), max)
}
