/**
 * Shared DOCX export - the third sibling of `export-csv.ts` and
 * `export-xlsx.ts`, and deliberately the same call shape, so one caller can
 * offer all three formats from a single table without reshaping its rows.
 *
 * WRITE ONLY. The `docx` library is used to build a document from values this
 * app already holds; nothing here opens or parses a file.
 *
 * The import is dynamic for the same reason as the XLSX one: the library is
 * several hundred kilobytes and an export button is pressed rarely, so it has
 * no business sitting in the bundle of every page that renders one.
 *
 * ── WHY A TABLE AND NOT PARAGRAPHS ───────────────────────────────────────────
 * A Word file of tabular data that is not IN a table cannot be sorted, widened
 * or pasted into anything, which leaves it worse than the CSV beside it. The
 * only reason to pick Word over the other two is to hand somebody a document
 * they can read and annotate, and that means a real table with a real header.
 */

type Cell = string | number | boolean | null | undefined

const text = (v: Cell): string => String(v ?? "")

/** Trigger a browser download for a built blob. */
function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Build a one-table Word document and hand it to the browser as a download.
 *
 * `title` becomes a heading above the table - a document that opens with no
 * indication of what it is gets renamed by whoever receives it.
 *
 * Async because of the dynamic import - await it if you need to know the file
 * was actually produced (e.g. to stop a spinner).
 */
export async function exportToDocx(
  header: string[],
  rows: Cell[][],
  filename: string,
  title?: string,
): Promise<void> {
  const {
    Document,
    Packer,
    Paragraph,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    TextRun,
    WidthType,
    AlignmentType,
  } = await import("docx")

  const cell = (value: Cell, bold = false) =>
    new TableCell({
      // One paragraph PER LINE. A cell of eight urls joined into a single run
      // renders as one unbroken string that runs off the table, and Word has no
      // equivalent of a spreadsheet's wrap toggle to rescue it afterwards.
      children: text(value)
        .split("\n")
        .map(
          (line) =>
            new Paragraph({
              children: [new TextRun({ text: line, bold, size: 18 })],
            }),
        ),
      // Shade the header so it survives being pasted somewhere that drops the
      // table borders.
      shading: bold ? { fill: "F3F4F6" } : undefined,
    })

  const table = new Table({
    // Fill the page rather than shrink to the content: a table narrower than
    // the margins reads as a fragment of something rather than the whole thing.
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true, // repeats on every page of a long export
        children: header.map((h) => cell(h, true)),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            // Pad short rows so a ragged one cannot shift the columns.
            children: header.map((_, i) => cell(row[i])),
          }),
      ),
    ],
  })

  const doc = new Document({
    sections: [
      {
        children: [
          ...(title
            ? [
                new Paragraph({
                  text: title,
                  heading: HeadingLevel.HEADING_1,
                  alignment: AlignmentType.LEFT,
                }),
              ]
            : []),
          table,
        ],
      },
    ],
  })

  // toBlob, not toBuffer: this runs in the browser, where Buffer does not exist.
  download(await Packer.toBlob(doc), filename)
}
