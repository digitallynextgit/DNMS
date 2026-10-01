// The drawing surface the slide layout is written against. Two implementations:
// PptxCanvas (native, editable PowerPoint objects) and PdfCanvas (pdfkit). The
// layout in slides.ts never knows which one it is drawing on, which is what
// keeps the PDF and the deck the same report. Units are inches on a 13.333 x
// 7.5 in (16:9) page; colours are 6-digit hex without '#'.

export const PAGE_W = 13.333
export const PAGE_H = 7.5

export interface Run {
  text: string
  bold?: boolean
  italic?: boolean
  color?: string
  size?: number
  /** End the paragraph after this run. */
  breakLine?: boolean
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface TextStyle {
  size: number
  color?: string
  bold?: boolean
  italic?: boolean
  align?: "left" | "center" | "right"
  valign?: "top" | "middle"
  /** Extra space between letters, in points. */
  charSpacing?: number
}

export interface Cell {
  runs: Run[]
  fill?: string
  align?: "left" | "center" | "right"
}

export interface TableSpec {
  x: number
  y: number
  colW: number[]
  rowH: number[]
  size: number
  color: string
  /** Hairline under every row. */
  border: string
  /** Inner cell padding, inches. */
  pad: number
}

export interface BarChartSpec extends Box {
  categories: string[]
  series: { name: string; color: string; values: number[] }[]
  stacked: boolean
  showValues: boolean
  legend: boolean
  labelColor: string
  labelSize: number
}

export interface Canvas {
  addSlide(background: string): void
  rect(b: Box, o: { fill: string; radius?: number; line?: string; shadow?: boolean }): void
  circle(b: Box, fill: string): void
  text(content: string | Run[], b: Box, s: TextStyle): void
  bullets(items: string[], b: Box, s: TextStyle & { gap: number }): void
  /** Draws the table and returns its bottom edge (rows grow to fit their text). */
  table(rows: Cell[][], spec: TableSpec): number
  barChart(spec: BarChartSpec): void
  /** How many lines `text` wraps to in a box `w` inches wide at `size` pt. */
  lineCount(text: string, w: number, size: number, bold?: boolean): number
  finish(): Promise<Uint8Array<ArrayBuffer>>
}
