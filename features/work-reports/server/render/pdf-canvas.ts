import "server-only"

import PDFDocument from "pdfkit"

import {
  PAGE_H,
  PAGE_W,
  type BarChartSpec,
  type Box,
  type Canvas,
  type Cell,
  type Run,
  type TableSpec,
  type TextStyle,
} from "./canvas"

// The same slides as the deck, drawn with pdfkit. Helvetica is built into every
// PDF reader, so nothing is embedded; it only covers Latin-1, hence `safe()`.
const PT = 72
const LINE_GAP = 1.5
/** pdfkit sets text from the top of the line box, so nudge vertically centred text onto the
 *  optical centre (Helvetica capitals fill only the top ~0.72). */
const opticalCentre = (size: number) => size * 0.2 + LINE_GAP / 2

const fontFor = (bold?: boolean, italic?: boolean) =>
  bold
    ? italic
      ? "Helvetica-BoldOblique"
      : "Helvetica-Bold"
    : italic
      ? "Helvetica-Oblique"
      : "Helvetica"
const hex = (c: string | undefined, fallback = "1F2433") => `#${c ?? fallback}`

/** Text Helvetica can draw: typographic punctuation mapped, other non-Latin-1 chars become '?'. */
export function safe(text: string): string {
  return text
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[•●]/g, "·")
    .replace(/ /g, " ")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\u0009\u000A\u000D -~ -ÿ]/g, "?")
}

/** Split runs into paragraphs at each `breakLine`. */
function paragraphs(runs: Run[]): Run[][] {
  const out: Run[][] = [[]]
  for (const r of runs) {
    out[out.length - 1]!.push(r)
    if (r.breakLine) out.push([])
  }
  return out.filter((p) => p.length)
}

export class PdfCanvas implements Canvas {
  private doc: PDFKit.PDFDocument
  private chunks: Buffer[] = []

  constructor(meta: { title: string; author: string }) {
    this.doc = new PDFDocument({
      size: [PAGE_W * PT, PAGE_H * PT],
      margin: 0,
      autoFirstPage: false,
      info: { Title: meta.title, Author: meta.author, Creator: "DNMS" },
    })
    this.doc.on("data", (c: Buffer) => this.chunks.push(c))
  }

  addSlide(background: string): void {
    this.doc.addPage({ size: [PAGE_W * PT, PAGE_H * PT], margin: 0 })
    this.doc.rect(0, 0, PAGE_W * PT, PAGE_H * PT).fill(hex(background))
  }

  rect(b: Box, o: { fill: string; radius?: number; line?: string; shadow?: boolean }): void {
    const d = this.doc
    const [x, y, w, h] = [b.x * PT, b.y * PT, b.w * PT, b.h * PT]
    const r = (o.radius ?? 0) * PT
    if (o.shadow) {
      d.save().opacity(0.07)
      d.roundedRect(x, y + 2, w, h, r).fill("#000000")
      d.restore()
    }
    const path = r ? d.roundedRect(x, y, w, h, r) : d.rect(x, y, w, h)
    if (o.line) path.lineWidth(0.75).fillAndStroke(hex(o.fill), hex(o.line))
    else path.fill(hex(o.fill))
  }

  circle(b: Box, fill: string): void {
    this.doc.circle((b.x + b.w / 2) * PT, (b.y + b.h / 2) * PT, (b.w / 2) * PT).fill(hex(fill))
  }

  private setFont(r: Run | undefined, st: TextStyle) {
    this.doc.font(fontFor(r?.bold ?? st.bold, r?.italic ?? st.italic)).fontSize(r?.size ?? st.size)
  }

  /** Height in points a set of runs takes when wrapped to `width` points. */
  private runsHeight(runs: Run[], width: number, st: TextStyle): number {
    let h = 0
    for (const para of paragraphs(runs)) {
      // Measure the paragraph in its largest run's font: a safe over-estimate.
      const lead = para.reduce((a, b) => ((b.size ?? st.size) > (a.size ?? st.size) ? b : a))
      this.setFont(lead, st)
      h += this.doc.heightOfString(safe(para.map((r) => r.text).join("")) || " ", {
        width,
        lineGap: LINE_GAP,
        characterSpacing: st.charSpacing,
      })
    }
    return h
  }

  private drawRuns(runs: Run[], x: number, y: number, width: number, st: TextStyle) {
    const d = this.doc
    let cursorY = y
    for (const para of paragraphs(runs)) {
      para.forEach((r, i) => {
        this.setFont(r, st)
        d.fillColor(hex(r.color ?? st.color))
        const opts = {
          width,
          align: st.align ?? "left",
          lineGap: LINE_GAP,
          characterSpacing: st.charSpacing,
          continued: i < para.length - 1,
        }
        if (i === 0) d.text(safe(r.text), x, cursorY, opts)
        else d.text(safe(r.text), opts)
      })
      cursorY = d.y
    }
  }

  text(content: string | Run[], b: Box, st: TextStyle): void {
    const runs = typeof content === "string" ? [{ text: content }] : content
    const width = b.w * PT
    let y = b.y * PT
    if (st.valign === "middle") {
      y += Math.max(0, (b.h * PT - this.runsHeight(runs, width, st)) / 2) + opticalCentre(st.size)
    }
    this.drawRuns(runs, b.x * PT, y, width, st)
  }

  bullets(items: string[], b: Box, st: TextStyle & { gap: number }): void {
    const d = this.doc
    const indent = 0.17 * PT
    let y = b.y * PT
    for (const item of items) {
      this.setFont(undefined, st)
      d.fillColor(hex(st.color))
      d.circle(b.x * PT + 3, y + st.size * 0.55, 1.6).fill(hex(st.color))
      d.fillColor(hex(st.color)).text(safe(item), b.x * PT + indent, y, {
        width: b.w * PT - indent,
        lineGap: LINE_GAP,
      })
      y = d.y + st.gap
    }
  }

  table(rows: Cell[][], spec: TableSpec): number {
    const d = this.doc
    const pad = spec.pad * PT
    const base: TextStyle = { size: spec.size, color: spec.color }
    let y = spec.y * PT
    rows.forEach((row, ri) => {
      const widths = spec.colW.map((w) => w * PT)
      const measured = Math.max(
        ...row.map(
          (cell, ci) => this.runsHeight(cell.runs, widths[ci]! - 2 * pad, base) + pad * 1.2,
        ),
      )
      const h = Math.max((spec.rowH[ri] ?? 0.4) * PT, measured)
      let x = spec.x * PT
      row.forEach((cell, ci) => {
        const w = widths[ci]!
        if (cell.fill) d.rect(x, y, w, h).fill(hex(cell.fill))
        const textH = this.runsHeight(cell.runs, w - 2 * pad, base)
        const lead = Math.max(...cell.runs.map((r) => r.size ?? spec.size))
        const top = Math.max(pad * 0.4, (h - textH) / 2 + opticalCentre(lead) * 0.6)
        this.drawRuns(cell.runs, x + pad, y + top, w - 2 * pad, {
          ...base,
          align: cell.align ?? "left",
        })
        x += w
      })
      d.moveTo(spec.x * PT, y + h)
        .lineTo(x, y + h)
        .lineWidth(0.75)
        .stroke(hex(spec.border))
      y += h
    })
    return y / PT
  }

  barChart(spec: BarChartSpec): void {
    const d = this.doc
    let top = spec.y * PT
    const left = spec.x * PT
    const width = spec.w * PT
    if (spec.legend && spec.series.length > 1) {
      d.font("Helvetica").fontSize(11)
      const legendW = spec.series.reduce((s, x) => s + d.widthOfString(safe(x.name)) + 26, 0) - 12
      let lx = left + (width - legendW) / 2
      for (const x of spec.series) {
        d.rect(lx, top + 4, 8, 8).fill(hex(x.color))
        d.fillColor(hex(spec.labelColor)).text(safe(x.name), lx + 12, top + 2, { lineBreak: false })
        lx += d.widthOfString(safe(x.name)) + 26
      }
      top += 0.4 * PT
    }
    const height = spec.y * PT + spec.h * PT - top
    d.font("Helvetica").fontSize(spec.labelSize)
    const labelW = Math.min(
      width * 0.42,
      Math.max(...spec.categories.map((c) => d.widthOfString(safe(c)))) + 12,
    )
    const totals = spec.categories.map((_, i) =>
      spec.stacked
        ? spec.series.reduce((s, x) => s + (x.values[i] ?? 0), 0)
        : Math.max(...spec.series.map((x) => x.values[i] ?? 0)),
    )
    const max = Math.max(1, ...totals) * (spec.showValues ? 1.18 : 1.02)
    const plotX = left + labelW
    const plotW = width - labelW
    const band = height / Math.max(1, spec.categories.length)
    const barH = Math.min(band * 0.64, 0.5 * PT)

    spec.categories.forEach((cat, i) => {
      const cy = top + band * i + band / 2
      d.font("Helvetica").fontSize(spec.labelSize).fillColor(hex(spec.labelColor))
      d.text(safe(cat), left, cy - spec.labelSize * 0.6, {
        width: labelW - 10,
        align: "right",
        lineBreak: false,
        ellipsis: true,
      })
      let x = plotX
      const bars = spec.stacked ? spec.series : spec.series.slice(0, 1)
      for (const s of bars) {
        const w = ((s.values[i] ?? 0) / max) * plotW
        if (w > 0) d.rect(x, cy - barH / 2, w, barH).fill(hex(s.color))
        x += spec.stacked ? w : 0
        if (!spec.stacked) x = plotX + w
      }
      if (spec.showValues) {
        d.font("Helvetica").fontSize(11).fillColor(hex(spec.labelColor))
        d.text(`${totals[i]!.toFixed(1)} h`, x + 6, cy - 6, { lineBreak: false })
      }
    })
  }

  lineCount(text: string, w: number, size: number, bold = false): number {
    this.doc.font(fontFor(bold)).fontSize(size)
    const h = this.doc.heightOfString(safe(text) || " ", { width: w * PT, lineGap: LINE_GAP })
    return Math.max(1, Math.round(h / (this.doc.currentLineHeight(true) + LINE_GAP)))
  }

  finish(): Promise<Uint8Array<ArrayBuffer>> {
    return new Promise((resolve, reject) => {
      this.doc.on("end", () => {
        const buf = Buffer.concat(this.chunks)
        const copy = new Uint8Array(new ArrayBuffer(buf.byteLength))
        copy.set(buf)
        resolve(copy)
      })
      this.doc.on("error", reject)
      this.doc.end()
    })
  }
}
