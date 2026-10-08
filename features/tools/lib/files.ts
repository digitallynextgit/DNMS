import { zipSync } from "fflate"

/** "84 KB", "1.2 MB" - for showing file sizes. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "-"
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`
  const mb = kb / 1024
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
}

/** How much smaller `after` is than `before`, as a whole percent (negative if bigger). */
export function savedPercent(before: number, after: number): number {
  if (before <= 0) return 0
  return Math.round(((before - after) / before) * 100)
}

/** Swap (or add) a file name's extension: photo.HEIC -> photo.jpg */
export function withExtension(name: string, ext: string): string {
  const dot = name.lastIndexOf(".")
  const base = dot > 0 ? name.slice(0, dot) : name
  return `${base}.${ext.replace(/^\./, "")}`
}

export function baseName(name: string): string {
  const dot = name.lastIndexOf(".")
  return dot > 0 ? name.slice(0, dot) : name
}

export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** One download instead of a pile of "allow multiple downloads?" prompts. Names are made unique. */
export async function zipBlobs(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const used = new Set<string>()
  const entries: Record<string, Uint8Array> = {}
  for (const f of files) {
    let name = f.name
    for (let i = 2; used.has(name); i++)
      name = `${baseName(f.name)} (${i})${f.name.slice(baseName(f.name).length)}`
    used.add(name)
    entries[name] = new Uint8Array(await f.blob.arrayBuffer())
  }
  // Images and PDFs are already compressed - level 0 just packs them, fast.
  const zipped = zipSync(entries, { level: 0 })
  return new Blob([zipped as BlobPart], { type: "application/zip" })
}

export function loadImage(source: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(source)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("This file couldn't be opened as an image"))
    }
    img.src = url
  })
}

/** Throws if the browser can't encode that type. */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Your browser couldn't create this file"))
        // A browser that can't encode `type` silently falls back to PNG.
        else if (blob.type !== type)
          reject(new Error(`Your browser can't save ${type.replace("image/", "").toUpperCase()}`))
        else resolve(blob)
      },
      type,
      quality,
    )
  })
}

export function fileMatches(file: File, accept: readonly string[]): boolean {
  const name = file.name.toLowerCase()
  return accept.some((a) => {
    const rule = a.toLowerCase()
    if (rule.startsWith(".")) return name.endsWith(rule)
    if (rule.endsWith("/*")) return file.type.startsWith(rule.slice(0, -1))
    return file.type === rule
  })
}
