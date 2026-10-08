// DOCX export, same call shape as export-csv / export-xlsx. Dynamically imported (big library, rare
// use). Data goes in a real table so it can be sorted and pasted.

type Cell = string | number | boolean | null | undefined

const text = (v: Cell): string => String(v ?? "")

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

/** `title` becomes a heading above the table. Async (dynamic import) - await it to stop a spinner. */
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
      // One paragraph per line, or a cell of joined URLs runs off the table.
      children: text(value)
        .split("\n")
        .map(
          (line) =>
            new Paragraph({
              children: [new TextRun({ text: line, bold, size: 18 })],
            }),
        ),
      // Shaded so the header survives a paste that drops borders.
      shading: bold ? { fill: "F3F4F6" } : undefined,
    })

  const table = new Table({
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
