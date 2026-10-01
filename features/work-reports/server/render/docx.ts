import "server-only"

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx"

import { INK, LINE, MUTED, TEXT, WARN, ZEBRA, personStyle } from "./theme"
import { dayLabel, formatHoursRound, formatHoursShort } from "../../lib/report-format"
import type { DayRow, PersonReport, WorkReport } from "../../types"

// The work report as a Word document: the same content as the slides, laid out
// to read top to bottom and to be edited before it is sent. A4 portrait.

const PAGE_CONTENT_DXA = 9900 // A4 width minus 0.7in margins, in twentieths of a point
const FONT = "Calibri"

type Runs = TextRun[]
const run = (
  text: string,
  o: { bold?: boolean; italics?: boolean; color?: string; size?: number } = {},
) =>
  new TextRun({
    text,
    font: FONT,
    bold: o.bold,
    italics: o.italics,
    color: o.color ?? TEXT,
    size: o.size ?? 21,
  })

const para = (
  children: Runs | string,
  o: { spacingAfter?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {},
) =>
  new Paragraph({
    children: typeof children === "string" ? [run(children)] : children,
    spacing: { after: o.spacingAfter ?? 120 },
    alignment: o.align,
  })

const heading = (
  text: string,
  level: (typeof HeadingLevel)[keyof typeof HeadingLevel],
  color = INK,
) =>
  new Paragraph({
    heading: level,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, font: FONT, bold: true, color })],
  })

const bullet = (children: Runs | string) =>
  new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: typeof children === "string" ? [run(children)] : children,
  })

const hairline = { style: BorderStyle.SINGLE, size: 4, color: LINE }
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }

function cell(children: Paragraph[], width: number, fill?: string): TableCell {
  return new TableCell({
    children,
    width: { size: width, type: WidthType.DXA },
    shading: fill ? { type: ShadingType.CLEAR, fill, color: "auto" } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    borders: { top: noBorder, left: noBorder, right: noBorder, bottom: hairline },
  })
}

/** Separates the lines inside one table cell. */
const LINE_BREAK = Symbol("line")
type CellContent = (TextRun | typeof LINE_BREAK)[]

/** A cell's content, one paragraph per line. */
function cellLines(content: CellContent): Runs[] {
  const out: Runs[] = [[]]
  for (const r of content) {
    if (r === LINE_BREAK) out.push([])
    else out[out.length - 1]!.push(r)
  }
  return out.filter((line) => line.length)
}

/** A table with a dark header row and zebra body rows. */
function table(
  header: string[],
  rows: (CellContent | string)[][],
  widths: number[],
  align: ("left" | "right" | "center")[] = [],
): Table {
  const al = (i: number) =>
    align[i] === "right"
      ? AlignmentType.RIGHT
      : align[i] === "center"
        ? AlignmentType.CENTER
        : AlignmentType.LEFT
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: header.map((h, i) =>
          cell(
            [
              para([run(h, { bold: true, color: "FFFFFF", size: 19 })], {
                spacingAfter: 0,
                align: al(i),
              }),
            ],
            widths[i]!,
            INK,
          ),
        ),
      }),
      ...rows.map(
        (row, ri) =>
          new TableRow({
            cantSplit: true,
            children: row.map((c, i) =>
              cell(
                (typeof c === "string" ? [[run(c)]] : cellLines(c)).map((runs) =>
                  para(runs, { spacingAfter: 40, align: al(i) }),
                ),
                widths[i]!,
                ri % 2 ? ZEBRA : undefined,
              ),
            ),
          }),
      ),
    ],
  })
}

const fmtDay = (d: string) => dayLabel(d).dm

function dayRowCells(row: DayRow, ink: string): CellContent[] {
  const dl = dayLabel(row.date)
  const tags = [row.wfh ? "WFH" : "", row.halfDayLeave ? "half-day leave" : ""].filter(Boolean)
  const date: CellContent = [
    run(dl.dm, { bold: true, color: INK }),
    LINE_BREAK,
    run(tags.length ? `${dl.dow} · ${tags.join(" · ")}` : dl.dow, {
      size: 18,
      color: tags.length ? WARN : MUTED,
      bold: tags.length > 0,
    }),
  ]
  const work: CellContent = []
  if (row.kind === "leave") work.push(run(row.label ?? "Leave", { italics: true, color: MUTED }))
  else if (row.kind === "idle")
    work.push(run("No task time recorded in DNMS", { italics: true, color: MUTED }))
  else {
    row.lines.forEach((l, i) => {
      if (i > 0) work.push(LINE_BREAK)
      work.push(
        run(l.project, { bold: true, color: ink }),
        run(`  ${formatHoursShort(l.hours)}   `, { color: MUTED, size: 18 }),
        run(l.text),
      )
    })
  }
  const total = row.kind === "work" ? formatHoursShort(row.hours) : "-"
  return [date, work, [run(total, { bold: true, color: INK })]]
}

function personSection(p: PersonReport, index: number): (Paragraph | Table)[] {
  const { ink } = personStyle(index)
  const leave = p.leaveDays.reduce((s, l) => s + l.days, 0)
  const out: (Paragraph | Table)[] = [
    new Paragraph({ children: [new PageBreak()] }),
    heading(p.name, HeadingLevel.HEADING_1, ink),
    para([
      run([p.designation, p.department].filter(Boolean).join(" · ") || "Employee", {
        color: MUTED,
      }),
    ]),
    para([
      run(`${formatHoursRound(p.totalHours)} on projects`, { bold: true }),
      run(
        `   ·   ${p.workingDays} working days${p.wfhDays ? ` (${p.wfhDays} WFH)` : ""}${leave ? `   ·   ${leave} day${leave === 1 ? "" : "s"} leave` : ""}   ·   ${p.tasksDone} tasks completed`,
      ),
    ]),
    heading("Hours by project", HeadingLevel.HEADING_3),
  ]
  if (p.projectHours.length) {
    out.push(
      table(
        ["Project", "Hours", "Share"],
        p.projectHours.map((x) => [
          x.project,
          formatHoursShort(x.hours),
          `${Math.round((x.hours / p.totalHours) * 100)}%`,
        ]),
        [6300, 1800, 1800],
        ["left", "right", "right"],
      ),
    )
  } else {
    out.push(
      para([
        run("No task time was recorded in DNMS for this month.", { italics: true, color: MUTED }),
      ]),
    )
  }
  out.push(heading("Highlights", HeadingLevel.HEADING_3))
  if (p.highlights.length) out.push(...p.highlights.map((h) => bullet(h)))
  else
    out.push(
      para([run("No completed or tracked tasks this month.", { italics: true, color: MUTED })]),
    )

  out.push(heading("Day by day", HeadingLevel.HEADING_3))
  if (p.days.length) {
    out.push(
      table(
        ["Date", "Work done (project · hours)", "Total"],
        p.days.map((d) => dayRowCells(d, ink)),
        [1500, 7400, 1000],
        ["left", "left", "right"],
      ),
    )
  } else {
    out.push(
      para([
        run("No working days with recorded activity in this period.", {
          italics: true,
          color: MUTED,
        }),
      ]),
    )
  }

  out.push(heading(`Open items carried forward`, HeadingLevel.HEADING_3))
  if (p.openItems.length) {
    const label = {
      IN_PROGRESS: "In progress",
      IN_REVIEW: "In review",
      TODO: "To do",
      ON_HOLD: "On hold",
    }
    out.push(
      ...p.openItems.map((o) =>
        bullet([
          run(`${label[o.status]}: `, { bold: true }),
          run(`${o.project}: ${o.text}${o.due ? ` (due ${fmtDay(o.due)})` : ""}`),
        ]),
      ),
    )
  } else {
    out.push(para([run("No open tasks due this month.", { color: MUTED })]))
  }
  return out
}

export async function renderWorkReportDocx(r: WorkReport): Promise<Uint8Array<ArrayBuffer>> {
  const people = r.people
  const fromDay = Number(r.period.from.slice(8))
  const toDay = Number(r.period.to.slice(8))
  const preparer = [r.preparedBy.name, r.preparedBy.designation].filter(Boolean).join(", ")

  const children: (Paragraph | Table)[] = [
    para([run("MONTH-END WORK REPORT", { bold: true, color: WARN, size: 20 })], {
      spacingAfter: 60,
    }),
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: 80 },
      children: [
        new TextRun({ text: r.period.label, font: FONT, bold: true, color: INK, size: 56 }),
      ],
    }),
    para([run(r.title, { size: 32, color: MUTED })]),
    para([
      run(
        `Period: ${fromDay} - ${toDay} ${r.period.label}${preparer ? `   ·   Prepared by ${preparer}` : ""}`,
        { color: MUTED },
      ),
    ]),

    heading("At a glance", HeadingLevel.HEADING_2),
    table(
      ["Hours of project work", "Tasks completed", "People", "Projects"],
      [
        [
          formatHoursRound(r.team.totalHours),
          String(r.team.tasksDone),
          String(people.length),
          String(r.team.projects.length),
        ],
      ],
      [2475, 2475, 2475, 2475],
      ["center", "center", "center", "center"],
    ),
    para(""),
    table(
      ["Person", "Role", "Hours", "Days", "Tasks done", "Mostly"],
      people.map((p, i) => [
        [run(p.name, { bold: true, color: personStyle(i).ink })],
        p.designation ?? "",
        formatHoursRound(p.totalHours),
        String(p.workingDays),
        String(p.tasksDone),
        p.focus || "-",
      ]),
      [1900, 1500, 900, 800, 1100, 3700],
      ["left", "left", "right", "right", "right", "left"],
    ),

    heading("Where the hours went", HeadingLevel.HEADING_2),
  ]

  if (r.team.projects.length) {
    const showPeople = people.length > 1 && people.length <= 5
    const personW = showPeople ? Math.floor(5400 / people.length) : 0
    children.push(
      table(
        ["Project", ...(showPeople ? people.map((p) => p.name.split(" ")[0]!) : []), "Total"],
        r.team.projects.map((proj) => [
          proj.project,
          ...(showPeople ? people.map((p) => formatHoursShort(proj.byPerson[p.id] ?? 0)) : []),
          [run(formatHoursRound(proj.total), { bold: true })],
        ]),
        [
          showPeople ? PAGE_CONTENT_DXA - 5400 - 1300 : 7600,
          ...people.filter(() => showPeople).map(() => personW),
          showPeople ? 1300 : 2300,
        ],
        ["left", ...people.filter(() => showPeople).map(() => "right" as const), "right"],
      ),
    )
  } else {
    children.push(
      para([
        run("No task time was recorded in DNMS for this period.", { italics: true, color: MUTED }),
      ]),
    )
  }

  if (r.impact.length) {
    children.push(heading("What was delivered", HeadingLevel.HEADING_2))
    const nameOf = new Map(people.map((p) => [p.id, p.name.split(" ")[0]!]))
    for (const card of r.impact) {
      children.push(
        para(
          [
            run(card.project, { bold: true, color: INK, size: 24 }),
            run(
              `   ${card.owners
                .map((id) => nameOf.get(id))
                .filter(Boolean)
                .join(", ")}`,
              { color: MUTED },
            ),
          ],
          { spacingAfter: 60 },
        ),
        ...card.bullets.map((b) => bullet(b)),
      )
    }
    if (r.aiPolished) {
      children.push(
        para([
          run("Bullets rewritten by AI from DNMS task titles and numbers; nothing was added.", {
            italics: true,
            color: MUTED,
            size: 18,
          }),
        ]),
      )
    }
  }

  people.forEach((p, i) => children.push(...personSection(p, i)))

  // ── Appendix ──
  const holidays = r.holidays.length
    ? ` and holidays (${r.holidays.map((h) => `${h.name}, ${fmtDay(h.date)}`).join("; ")})`
    : " and company holidays"
  children.push(
    new Paragraph({ children: [new PageBreak()] }),
    heading("How the hours were measured", HeadingLevel.HEADING_1),
    bullet(
      `Days counted: Monday to Friday only. Saturdays, Sundays${holidays} are left out, as are full-day leaves.`,
    ),
    bullet(
      "Each task's In Progress time in DNMS, counted only between that day's check-in and check-out (09:30 - 19:30 IST without a punch).",
    ),
    bullet(
      "A task left In Progress after the day ended counts only on the day it started, up to its estimated hours.",
    ),
    bullet("When two tasks ran at the same time, the time is split between them."),
    bullet(
      "Ad-hoc tasks whose title names a project are counted under that project; the rest are shown as ADHOC.",
    ),
    heading("Attendance vs. project hours", HeadingLevel.HEADING_3),
    table(
      ["Person", "Days in office", "Office hours", "Project hours"],
      people.map((p, i) => [
        [run(p.name, { bold: true, color: personStyle(i).ink })],
        `${p.officeDays}${p.wfhDays ? ` + ${p.wfhDays} WFH` : ""}`,
        formatHoursRound(p.officeHours),
        formatHoursRound(p.totalHours),
      ]),
      [3600, 2100, 2100, 2100],
      ["left", "center", "center", "center"],
    ),
    para([
      run(
        "Days in office counts days with an attendance punch; WFH days have none. Project hours can be lower than office hours: meetings and untracked work do not run a task clock.",
        { italics: true, color: MUTED, size: 18 },
      ),
    ]),
  )
  const capped = people.flatMap((p) => p.capped.map((x) => ({ ...x, person: p.name })))
  if (capped.length) {
    children.push(
      heading("Tasks left In Progress (corrected)", HeadingLevel.HEADING_3),
      table(
        ["Person", "Date", "Task", "Left running", "Counted"],
        capped.map((x) => [
          x.person,
          fmtDay(x.date),
          `${x.project}: ${x.task}`,
          `${x.leftRunningHours.toFixed(1)} h`,
          [run(`${x.countedHours.toFixed(1)} h`, { bold: true })],
        ]),
        [1800, 1000, 4500, 1300, 1300],
        ["left", "left", "left", "right", "right"],
      ),
    )
  }

  const doc = new Document({
    creator: r.preparedBy.name || "DNMS",
    title: `${r.title} - ${r.period.label} work report`,
    styles: { default: { document: { run: { font: FONT, size: 21, color: TEXT } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1008, bottom: 1008, left: 1008, right: 1008 } } },
        children,
      },
    ],
  })
  const buffer = await Packer.toBuffer(doc)
  const copy = new Uint8Array(new ArrayBuffer(buffer.byteLength))
  copy.set(buffer)
  return copy
}
