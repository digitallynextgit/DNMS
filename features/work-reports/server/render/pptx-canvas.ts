import "server-only"

import PptxGenJS from "pptxgenjs"

import type { BarChartSpec, Box, Canvas, Cell, Run, TableSpec, TextStyle } from "./canvas"

// Native PowerPoint objects, so the deck stays editable: real text boxes, real
// tables, real charts. Calibri ships with every Office install.
const FONT = "Calibri"
/** Calibri's average glyph width as a fraction of the font size. */
const AVG_GLYPH_EM = 0.49

type Slide = ReturnType<PptxGenJS["addSlide"]>

const runOptions = (r: Run, base: TextStyle) => ({
  bold: r.bold ?? base.bold,
  italic: r.italic ?? base.italic,
  color: r.color ?? base.color,
  fontSize: r.size ?? base.size,
  breakLine: r.breakLine,
})

export class PptxCanvas implements Canvas {
  private pres = new PptxGenJS()
  private slide: Slide | null = null

  constructor(meta: { title: string; author: string }) {
    this.pres.layout = "LAYOUT_WIDE"
    this.pres.title = meta.title
    this.pres.author = meta.author
  }

  private get s(): Slide {
    if (!this.slide) throw new Error("addSlide() first")
    return this.slide
  }

  addSlide(background: string): void {
    this.slide = this.pres.addSlide()
    this.slide.background = { color: background }
  }

  rect(b: Box, o: { fill: string; radius?: number; line?: string; shadow?: boolean }): void {
    this.s.addShape(o.radius ? this.pres.ShapeType.roundRect : this.pres.ShapeType.rect, {
      ...b,
      fill: { color: o.fill },
      line: { color: o.line ?? o.fill, width: o.line ? 1 : 0 },
      ...(o.radius ? { rectRadius: o.radius } : {}),
      // pptxgenjs mutates option objects, so every shadow is a fresh literal.
      ...(o.shadow
        ? {
            shadow: {
              type: "outer" as const,
              color: "000000",
              opacity: 0.08,
              blur: 6,
              offset: 2,
              angle: 90,
            },
          }
        : {}),
    })
  }

  circle(b: Box, fill: string): void {
    this.s.addShape(this.pres.ShapeType.ellipse, {
      ...b,
      fill: { color: fill },
      line: { color: fill },
    })
  }

  text(content: string | Run[], b: Box, st: TextStyle): void {
    const runs = typeof content === "string" ? [{ text: content }] : content
    this.s.addText(
      runs.map((r) => ({ text: r.text, options: runOptions(r, st) })),
      {
        ...b,
        fontFace: FONT,
        fontSize: st.size,
        color: st.color,
        bold: st.bold,
        italic: st.italic,
        align: st.align ?? "left",
        valign: st.valign ?? "top",
        charSpacing: st.charSpacing,
        margin: 0,
        isTextBox: true,
      },
    )
  }

  bullets(items: string[], b: Box, st: TextStyle & { gap: number }): void {
    this.s.addText(
      items.map((t, i) => ({
        text: t,
        options: {
          bullet: { indent: 12 },
          breakLine: i < items.length - 1,
          paraSpaceAfter: st.gap,
        },
      })),
      {
        ...b,
        fontFace: FONT,
        fontSize: st.size,
        color: st.color,
        valign: "top",
        margin: 0,
        isTextBox: true,
      },
    )
  }

  table(rows: Cell[][], spec: TableSpec): number {
    const hairline = { type: "solid" as const, pt: 0.75, color: spec.border }
    const none = { type: "none" as const }
    this.s.addTable(
      rows.map((row) =>
        row.map((cell) => ({
          text: cell.runs.map((r) => ({
            text: r.text,
            options: runOptions(r, { size: spec.size, color: spec.color }),
          })),
          options: {
            fill: cell.fill ? { color: cell.fill } : undefined,
            align: cell.align ?? "left",
            valign: "middle" as const,
            border: [none, none, hairline, none] as [
              typeof none,
              typeof none,
              typeof hairline,
              typeof none,
            ],
          },
        })),
      ),
      {
        x: spec.x,
        y: spec.y,
        w: spec.colW.reduce((a, b) => a + b, 0),
        colW: spec.colW,
        rowH: spec.rowH,
        fontFace: FONT,
        fontSize: spec.size,
        color: spec.color,
        margin: [spec.pad * 0.5, spec.pad, spec.pad * 0.5, spec.pad],
      },
    )
    return spec.y + spec.rowH.reduce((a, b) => a + b, 0)
  }

  barChart(spec: BarChartSpec): void {
    const max = Math.max(
      1,
      ...spec.categories.map((_, i) =>
        spec.stacked
          ? spec.series.reduce((s, x) => s + (x.values[i] ?? 0), 0)
          : Math.max(...spec.series.map((x) => x.values[i] ?? 0)),
      ),
    )
    this.s.addChart(
      this.pres.ChartType.bar,
      spec.series.map((x) => ({ name: x.name, labels: spec.categories, values: x.values })),
      {
        x: spec.x,
        y: spec.y,
        w: spec.w,
        h: spec.h,
        barDir: "bar",
        barGrouping: spec.stacked ? "stacked" : "clustered",
        barGapWidthPct: 45,
        chartColors: spec.series.map((x) => x.color),
        // Biggest bar on top. "maxMin" is valid OOXML and pptxgenjs writes the
        // value through verbatim; only its type definition lists "minMax" alone.
        catAxisOrientation: "maxMin" as "minMax",
        catAxisLabelColor: spec.labelColor,
        catAxisLabelFontSize: spec.labelSize,
        catAxisLabelFontFace: FONT,
        catAxisLineShow: false,
        valAxisHidden: true,
        valAxisMinVal: 0,
        valAxisMaxVal: Math.ceil(max * (spec.showValues ? 1.22 : 1.02)),
        valGridLine: { style: "none" },
        catGridLine: { style: "none" },
        showLegend: spec.legend,
        legendPos: "t",
        legendFontSize: 12,
        legendFontFace: FONT,
        legendColor: spec.labelColor,
        ...(spec.showValues
          ? {
              showValue: true,
              dataLabelPosition: "outEnd" as const,
              dataLabelFormatCode: '0.0" h"',
              dataLabelColor: spec.labelColor,
              dataLabelFontSize: 11,
              dataLabelFontFace: FONT,
            }
          : {}),
      },
    )
  }

  lineCount(text: string, w: number, size: number, bold = false): number {
    // Greedy word wrap against an average glyph width - PowerPoint lays the text
    // out itself, so this only has to be a slight over-estimate, never under.
    const glyph = (size * AVG_GLYPH_EM * (bold ? 1.06 : 1)) / 72
    const capacity = Math.max(1, Math.floor(w / glyph))
    let lines = 1
    let used = 0
    for (const word of text.split(/\s+/).filter(Boolean)) {
      const len = word.length
      if (used === 0) used = len
      else if (used + 1 + len <= capacity) used += 1 + len
      else {
        lines += 1
        used = len
      }
      while (used > capacity) {
        lines += 1
        used -= capacity
      }
    }
    return lines
  }

  async finish(): Promise<Uint8Array<ArrayBuffer>> {
    const out = (await this.pres.write({ outputType: "nodebuffer" })) as Uint8Array
    // BodyInit wants ArrayBuffer-backed bytes, not a Buffer view into a shared pool.
    const copy = new Uint8Array(new ArrayBuffer(out.byteLength))
    copy.set(out)
    return copy
  }
}
