import "server-only"

import { PAGE_W as W, type Canvas, type Cell, type Run } from "./canvas"
import {
  AMBER,
  CARD,
  INK,
  LINE,
  MUTED,
  TEXT,
  WARN,
  WHITE,
  ZEBRA,
  initials,
  personStyle,
} from "./theme"
import { dayLabel, formatHoursRound, formatHoursShort } from "../../lib/report-format"
import { round1 } from "../../lib/work-hours"
import type { DayRow, OpenItem, PersonReport, WorkReport } from "../../types"

// The work report as slides (same for .pptx and .pdf): title, at a glance, where the hours
// went, impact, each person (summary + every working day), open items, appendix.

const MX = 0.6
const TABLE_Y = 1.5
const TABLE_BOTTOM = 6.85
const DAY_COLS = [1.3, 9.88, 0.95]
const TABLE_PAD = 0.1
const MAX_CHART_ROWS = 12

type Person = PersonReport & { color: string; ink: string; badge: string }
type SlideFn = (c: Canvas, page: number, total: number) => void

const fmtDay = (d: string) => dayLabel(d).dm
const firstName = (name: string) => name.split(" ")[0] ?? name
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)
const chunk = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, i * size + size),
  )
const truncate = (s: string, max: number) =>
  s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`

const STATUS_CHIP: Record<OpenItem["status"], { label: string; color: string }> = {
  IN_PROGRESS: { label: "In progress", color: "4C5BD4" },
  IN_REVIEW: { label: "In review", color: "7A4FD6" },
  TODO: { label: "To do", color: WARN },
  ON_HOLD: { label: "On hold", color: "8A8FA6" },
}

export function renderSlides(c: Canvas, r: WorkReport): void {
  const people: Person[] = r.people.map((p, i) => ({
    ...p,
    ...personStyle(i),
    badge: initials(p.name),
  }))
  const byId = new Map(people.map((p) => [p.id, p]))
  const slides: SlideFn[] = []

  const footer = (c: Canvas, page: number, total: number, dark = false) => {
    const color = dark ? "8B90AA" : MUTED
    c.text(
      `${r.title}  ·  ${r.period.label} work report`,
      { x: MX, y: 7.0, w: 8, h: 0.3 },
      { size: 9, color },
    )
    c.text(
      `${page} / ${total}`,
      { x: W - MX - 1.5, y: 7.0, w: 1.5, h: 0.3 },
      { size: 9, color, align: "right" },
    )
  }
  const badge = (c: Canvas, p: Person, x: number, y: number, size: number) => {
    c.circle({ x, y, w: size, h: size }, p.color)
    c.text(
      p.badge,
      { x, y, w: size, h: size },
      {
        size: Math.max(8, Math.round(size * (p.badge.length > 1 ? 26 : 34))),
        bold: true,
        color: WHITE,
        align: "center",
        valign: "middle",
      },
    )
  }
  const header = (c: Canvas, kicker: string, title: string, p?: Person) => {
    let x = MX
    if (p) {
      badge(c, p, MX, 0.45, 0.62)
      x = MX + 0.82
    }
    c.text(
      kicker.toUpperCase(),
      { x, y: 0.4, w: W - x - MX, h: 0.28 },
      {
        size: 11,
        bold: true,
        color: p ? p.ink : MUTED,
        charSpacing: 2,
      },
    )
    const w = W - x - MX
    const size = [28, 25, 22, 20].find((s) => c.lineCount(title, w, s, true) <= 1) ?? 20
    c.text(title, { x, y: 0.66, w, h: 0.62 }, { size, bold: true, color: INK, valign: "middle" })
  }
  const tile = (
    c: Canvas,
    x: number,
    y: number,
    w: number,
    h: number,
    value: string,
    label: string,
    color: string,
  ) => {
    c.rect({ x, y, w, h }, { fill: CARD, radius: 0.08 })
    c.text(
      value,
      { x: x + 0.22, y: y + 0.12, w: w - 0.44, h: h * 0.55 },
      { size: 30, bold: true, color, valign: "middle" },
    )
    c.text(
      label,
      { x: x + 0.22, y: y + h * 0.62, w: w - 0.44, h: h * 0.34 },
      { size: 11.5, color: MUTED },
    )
  }
  const workingDaysNote = (p: Person) => {
    const parts = [
      p.wfhDays ? `${p.wfhDays} WFH` : "",
      p.leaveDays.length ? `${p.leaveDays.reduce((s, l) => s + l.days, 0)} leave` : "",
    ].filter(Boolean)
    return parts.length ? `Working days (${parts.join(", ")})` : "Working days"
  }

  slides.push((c, page, total) => {
    c.addSlide(INK)
    c.text(
      "MONTH-END WORK REPORT",
      { x: MX + 0.1, y: 1.2, w: 8, h: 0.4 },
      { size: 14, bold: true, color: AMBER, charSpacing: 4 },
    )
    c.text(
      r.period.label,
      { x: MX + 0.1, y: 1.65, w: 11, h: 1.1 },
      { size: 58, bold: true, color: WHITE },
    )
    c.text(r.title, { x: MX + 0.1, y: 2.75, w: 11.5, h: 0.7 }, { size: 30, color: "C9CEF0" })

    if (people.length <= 3) {
      people.forEach((p, i) => {
        const x = MX + 0.1 + i * 3.9
        badge(c, p, x, 4.2, 0.72)
        c.text(
          p.name,
          { x: x + 0.92, y: 4.22, w: 2.9, h: 0.38 },
          { size: 16, bold: true, color: WHITE },
        )
        c.text(
          p.designation ?? "",
          { x: x + 0.92, y: 4.6, w: 2.9, h: 0.3 },
          { size: 12.5, color: "A9AECB" },
        )
      })
    } else {
      const shown = people.length > 9 ? people.slice(0, 8) : people
      shown.forEach((p, i) => {
        const x = MX + 0.1 + (i % 3) * 3.9
        const y = 3.75 + Math.floor(i / 3) * 0.6
        badge(c, p, x, y, 0.46)
        c.text(
          p.name,
          { x: x + 0.6, y, w: 3.1, h: 0.46 },
          { size: 14, bold: true, color: WHITE, valign: "middle" },
        )
      })
      if (people.length > 9) {
        c.text(
          `+ ${people.length - 8} more`,
          { x: MX + 0.1 + 2 * 3.9, y: 3.75 + 2 * 0.6, w: 3, h: 0.46 },
          {
            size: 14,
            color: "A9AECB",
            valign: "middle",
          },
        )
      }
    }
    const preparer = [r.preparedBy.name, r.preparedBy.designation].filter(Boolean).join(", ")
    const fromDay = Number(r.period.from.slice(8))
    const toDay = Number(r.period.to.slice(8))
    c.text(
      `Period: ${fromDay} - ${toDay} ${r.period.label}${preparer ? `   ·   Prepared by ${preparer}` : ""}`,
      {
        x: MX + 0.1,
        y: 5.85,
        w: 12,
        h: 0.35,
      },
      { size: 13, color: "A9AECB" },
    )
    c.text(
      "Source: DNMS task clock, tasks, attendance, leave, WFH and holiday records",
      {
        x: MX + 0.1,
        y: 6.2,
        w: 12,
        h: 0.3,
      },
      { size: 11, italic: true, color: "7D82A0" },
    )
    footer(c, page, total, true)
  })

  const clientProjects = r.team.projects.filter((p) => p.total > 0)
  const personCard = (c: Canvas, p: Person, x: number, y: number, w: number, h: number) => {
    const compact = h < 3
    c.rect({ x, y, w, h }, { fill: WHITE, line: LINE, radius: 0.08, shadow: true })
    badge(c, p, x + 0.3, y + 0.28, 0.6)
    c.text(
      p.name,
      { x: x + 1.05, y: y + 0.28, w: w - 1.3, h: 0.34 },
      { size: 15, bold: true, color: INK },
    )
    c.text(
      p.designation ?? "",
      { x: x + 1.05, y: y + 0.6, w: w - 1.3, h: 0.28 },
      { size: 11.5, color: MUTED },
    )
    const hy = y + (compact ? 0.98 : 1.1)
    c.text(
      formatHoursRound(p.totalHours),
      { x: x + 0.3, y: hy, w: w - 0.6, h: 0.6 },
      { size: 28, bold: true, color: p.ink },
    )
    c.text(
      `${p.workingDays} working days   ·   ${p.tasksDone} tasks done`,
      { x: x + 0.3, y: hy + 0.62, w: w - 0.6, h: 0.3 },
      {
        size: 11.5,
        color: MUTED,
      },
    )
    c.text(
      p.focus ? `Mostly ${p.focus}` : "No task time recorded",
      { x: x + 0.3, y: hy + 1.02, w: w - 0.6, h: compact ? 0.4 : 0.9 },
      {
        size: 12,
        color: TEXT,
      },
    )
  }
  const cw = (W - 2 * MX - 2 * 0.3) / 3
  slides.push((c, page, total) => {
    c.addSlide(WHITE)
    header(c, "Summary", `${r.period.label} at a glance`)
    const tiles: [string, string][] = [
      [formatHoursRound(r.team.totalHours), "Hours of project work"],
      [String(r.team.tasksDone), "Tasks completed in DNMS"],
      [
        String(people.length),
        people.length === 1 ? "Person in this report" : "People in this report",
      ],
      [String(clientProjects.length), "Projects worked on"],
    ]
    const tw = (W - 2 * MX - 3 * 0.3) / 4
    tiles.forEach(([v, l], i) => tile(c, MX + i * (tw + 0.3), 1.55, tw, 1.3, v, l, INK))
    people.slice(0, 3).forEach((p, i) => personCard(c, p, MX + i * (cw + 0.3), 3.2, cw, 3.45))
    footer(c, page, total)
  })
  for (const group of chunk(people.slice(3), 6)) {
    slides.push((c, page, total) => {
      c.addSlide(WHITE)
      header(c, "Summary", "Everyone at a glance")
      group.forEach((p, i) =>
        personCard(c, p, MX + (i % 3) * (cw + 0.3), 1.55 + Math.floor(i / 3) * 2.65, cw, 2.45),
      )
      footer(c, page, total)
    })
  }

  slides.push((c, page, total) => {
    c.addSlide(WHITE)
    header(c, "Time allocation", "Where the hours went")
    if (r.team.totalHours <= 0) {
      c.text(
        "No task time was recorded in DNMS for this period.",
        { x: MX, y: 3, w: W - 2 * MX, h: 0.6 },
        {
          size: 18,
          color: MUTED,
          align: "center",
        },
      )
      footer(c, page, total)
      return
    }
    let rows = clientProjects
    if (rows.length > MAX_CHART_ROWS) {
      const rest = rows.slice(MAX_CHART_ROWS - 1)
      const other = {
        project: `${rest.length} other projects`,
        total: 0,
        byPerson: {} as Record<string, number>,
      }
      for (const p of rest) {
        other.total = round1(other.total + p.total)
        for (const [id, h] of Object.entries(p.byPerson))
          other.byPerson[id] = round1((other.byPerson[id] ?? 0) + h)
      }
      rows = [...rows.slice(0, MAX_CHART_ROWS - 1), other]
    }
    c.barChart({
      x: MX,
      y: 1.45,
      w: 8.2,
      h: 5.45,
      categories: rows.map((p) => `${p.project}   ${formatHoursRound(p.total)}`),
      series: people.map((p) => ({
        name: firstName(p.name),
        color: p.color,
        values: rows.map((row) => round1(row.byPerson[p.id] ?? 0)),
      })),
      stacked: true,
      showValues: false,
      legend: people.length > 1,
      labelColor: TEXT,
      labelSize: 12,
    })
    const top = clientProjects.slice(0, 4)
    const topHours = top.reduce((s, p) => s + p.total, 0)
    const notes: [string, string][] = [
      [
        `${pct(topHours, r.team.totalHours)}%`,
        top.length > 1
          ? `of all hours went to ${top.length} projects: ${top.map((p) => p.project).join(", ")}.`
          : `of all hours went to ${top[0]?.project ?? "one project"}.`,
      ],
      [
        formatHoursRound(clientProjects[0]?.total ?? 0),
        `on ${clientProjects[0]?.project ?? "-"}, the largest single project.`,
      ],
      r.team.adhocHours > 0
        ? [
            formatHoursRound(r.team.adhocHours),
            `of ad-hoc work (${pct(r.team.adhocHours, r.team.totalHours)}%): tasks with no client.`,
          ]
        : [String(r.team.tasksDone), "tasks completed across everyone in this report."],
    ]
    notes.forEach(([big, small], i) => {
      const y = 1.6 + i * 1.75
      c.rect({ x: 9.15, y, w: 3.58, h: 1.5 }, { fill: CARD, radius: 0.08 })
      c.text(big, { x: 9.4, y: y + 0.14, w: 3.1, h: 0.55 }, { size: 26, bold: true, color: INK })
      c.text(small, { x: 9.4, y: y + 0.7, w: 3.1, h: 0.75 }, { size: 11.5, color: TEXT })
    })
    footer(c, page, total)
  })

  if (r.impact.length) {
    slides.push((c, page, total) => {
      c.addSlide(WHITE)
      header(c, "Impact", "What was delivered")
      const ch = 2.5
      r.impact.forEach((card, i) => {
        const x = MX + (i % 3) * (cw + 0.3)
        const y = 1.5 + Math.floor(i / 3) * (ch + 0.25)
        c.rect({ x, y, w: cw, h: ch }, { fill: CARD, radius: 0.08 })
        const owners = card.owners
          .map((id) => byId.get(id))
          .filter((p): p is Person => !!p)
          .slice(0, 4)
        const badgesW = owners.length * 0.36
        c.text(
          card.project,
          { x: x + 0.25, y: y + 0.18, w: cw - 0.5 - badgesW, h: 0.36 },
          { size: 15, bold: true, color: INK },
        )
        owners.forEach((p, j) =>
          badge(c, p, x + cw - 0.25 - (owners.length - j) * 0.36 + 0.04, y + 0.2, 0.32),
        )
        c.bullets(
          card.bullets,
          { x: x + 0.22, y: y + 0.62, w: cw - 0.42, h: ch - 0.75 },
          { size: 11, color: TEXT, gap: 4 },
        )
      })
      if (r.aiPolished) {
        c.text(
          "Bullets rewritten by AI from DNMS task titles and numbers; nothing was added.",
          {
            x: MX,
            y: 6.72,
            w: 9,
            h: 0.25,
          },
          { size: 9.5, italic: true, color: MUTED },
        )
      }
      footer(c, page, total)
    })
  }

  const dayRowLines = (c: Canvas, row: DayRow) =>
    row.kind !== "work"
      ? 1
      : row.lines.reduce(
          (n, l) =>
            n +
            c.lineCount(
              `${l.project}  ${formatHoursShort(l.hours)}   ${l.text}`,
              DAY_COLS[1]! - 2 * TABLE_PAD,
              11,
            ),
          0,
        )
  const dayRowHeight = (c: Canvas, row: DayRow) =>
    Math.max(0.56, dayRowLines(c, row) * 0.205 + 0.16)

  for (const p of people) {
    slides.push((c, page, total) => personSummary(c, p, page, total))
    // Paginate up front, measuring text on the same canvas the slides use.
    const pages = paginateDays(c, p.days)
    pages.forEach((rows, i) =>
      slides.push((c, page, total) => dayTable(c, p, rows, i, pages.length, page, total)),
    )
  }

  function personSummary(c: Canvas, p: Person, page: number, total: number) {
    c.addSlide(WHITE)
    const kicker = [p.designation, p.department].filter(Boolean).join("  ·  ") || "Employee"
    header(c, kicker, truncate(p.focus ? `${p.name}: ${p.focus}` : p.name, 64), p)

    c.text(
      "Hours by project",
      { x: MX, y: 1.55, w: 6, h: 0.3 },
      { size: 13, bold: true, color: INK },
    )
    if (p.projectHours.length) {
      let rows = p.projectHours
      if (rows.length > 8) {
        const rest = rows.slice(7)
        rows = [
          ...rows.slice(0, 7),
          {
            project: `${rest.length} others`,
            hours: round1(rest.reduce((s, x) => s + x.hours, 0)),
          },
        ]
      }
      c.barChart({
        x: MX - 0.1,
        y: 1.9,
        w: 6.3,
        h: Math.min(4.5, 0.55 * rows.length + 0.4),
        categories: rows.map((x) => x.project),
        series: [{ name: "Hours", color: p.color, values: rows.map((x) => x.hours) }],
        stacked: false,
        showValues: true,
        legend: false,
        labelColor: TEXT,
        labelSize: 12,
      })
    } else {
      c.text(
        "No task time was recorded in DNMS for this month.",
        { x: MX, y: 2.2, w: 6, h: 0.5 },
        { size: 14, color: MUTED },
      )
    }
    const note = [
      "Hours from the DNMS task clock, counted within office hours only.",
      p.capped.length
        ? `${p.capped.length} task${p.capped.length === 1 ? " was" : "s were"} left In Progress after work stopped and capped at the estimate (see appendix).`
        : "",
    ]
      .filter(Boolean)
      .join(" ")
    c.text(note, { x: MX, y: 6.45, w: 6.1, h: 0.5 }, { size: 10, italic: true, color: MUTED })

    const tx = 7.15
    const tw = (W - MX - tx - 0.25) / 2
    const top = p.projectHours[0]
    const tiles: [string, string][] = [
      [formatHoursRound(p.totalHours), "Hours tracked on projects"],
      [String(p.workingDays), workingDaysNote(p)],
      [String(p.tasksDone), "Tasks completed"],
      top
        ? [`${pct(top.hours, p.totalHours)}%`, `Of time on ${truncate(top.project, 22)}`]
        : [String(p.tasksWorked), "Tasks worked on"],
    ]
    tiles.forEach(([v, l], i) =>
      tile(c, tx + (i % 2) * (tw + 0.25), 1.55 + Math.floor(i / 2) * 1.32, tw, 1.12, v, l, p.ink),
    )
    c.text("Highlights", { x: tx, y: 4.3, w: 5, h: 0.32 }, { size: 13, bold: true, color: INK })
    if (p.highlights.length) {
      c.bullets(
        p.highlights,
        { x: tx, y: 4.68, w: W - MX - tx, h: 2.2 },
        { size: 12, color: TEXT, gap: 5 },
      )
    } else {
      c.text(
        "No completed or tracked tasks this month.",
        { x: tx, y: 4.68, w: W - MX - tx, h: 0.4 },
        { size: 12, color: MUTED },
      )
    }
    footer(c, page, total)
  }

  function paginateDays(c: Canvas, rows: DayRow[]): DayRow[][] {
    if (rows.length === 0) return [[]]
    const pages: DayRow[][] = []
    let cur: DayRow[] = []
    let h = 0.4
    for (const row of rows) {
      const rh = dayRowHeight(c, row)
      if (cur.length && TABLE_Y + h + rh > TABLE_BOTTOM) {
        pages.push(cur)
        cur = []
        h = 0.4
      }
      cur.push(row)
      h += rh
    }
    pages.push(cur)
    return pages
  }

  function dayTable(
    c: Canvas,
    p: Person,
    rows: DayRow[],
    idx: number,
    n: number,
    page: number,
    total: number,
  ) {
    c.addSlide(WHITE)
    const range = rows.length
      ? `${fmtDay(rows[0]!.date)} - ${fmtDay(rows[rows.length - 1]!.date)}`
      : r.period.label
    header(c, `${p.name}  ·  day by day  ·  ${idx + 1} of ${n}`, range, p)
    if (!rows.length) {
      c.text(
        "No working days with recorded activity in this period.",
        { x: MX, y: 2.2, w: 10, h: 0.5 },
        { size: 14, color: MUTED },
      )
      footer(c, page, total)
      return
    }
    const head: Cell[] = ["Date", "Work done  (project · hours)", "Total"].map((t, i) => ({
      runs: [{ text: t, bold: true, color: WHITE, size: 11 }],
      fill: INK,
      align: i === 2 ? "right" : "left",
    }))
    const body: Cell[][] = rows.map((row, ri) => {
      const fill = ri % 2 ? ZEBRA : WHITE
      const dl = dayLabel(row.date)
      const tags = [row.wfh ? "WFH" : "", row.halfDayLeave ? "half-day leave" : ""].filter(Boolean)
      const dateCell: Cell = {
        fill,
        runs: [
          { text: dl.dm, bold: true, size: 12, color: INK, breakLine: true },
          {
            text: tags.length ? `${dl.dow} · ${tags.join(" · ")}` : dl.dow,
            size: 10,
            bold: tags.length > 0,
            color: tags.length ? WARN : MUTED,
          },
        ],
      }
      let work: Cell
      if (row.kind === "leave") {
        work = { fill, runs: [{ text: row.label ?? "Leave", italic: true, color: MUTED }] }
      } else if (row.kind === "idle") {
        work = {
          fill,
          runs: [{ text: "No task time recorded in DNMS", italic: true, color: MUTED }],
        }
      } else {
        const runs: Run[] = []
        row.lines.forEach((l, li) => {
          runs.push({ text: l.project, bold: true, color: p.ink })
          runs.push({ text: `  ${formatHoursShort(l.hours)}   `, color: MUTED, size: 10 })
          runs.push({ text: l.text, color: TEXT, breakLine: li < row.lines.length - 1 })
        })
        work = { fill, runs }
      }
      const totalCell: Cell = {
        fill,
        align: "right",
        runs: [
          {
            text: row.kind === "work" ? formatHoursShort(row.hours) : "-",
            bold: true,
            color: INK,
            size: 12,
          },
        ],
      }
      return [dateCell, work, totalCell]
    })
    c.table([head, ...body], {
      x: MX,
      y: TABLE_Y,
      colW: DAY_COLS,
      rowH: [0.4, ...rows.map((row) => dayRowHeight(c, row))],
      size: 11,
      color: TEXT,
      border: LINE,
      pad: TABLE_PAD,
    })
    footer(c, page, total)
  }

  for (const group of chunk(people, 3)) {
    slides.push((c, page, total) => {
      c.addSlide(WHITE)
      header(c, "Looking ahead", `Open items carried into ${nextMonthLabel(r.period.month)}`)
      group.forEach((p, i) => {
        const x = MX + i * (cw + 0.3)
        const top = 1.55
        const bottom = 6.35
        c.rect({ x, y: top, w: cw, h: bottom - top }, { fill: CARD, radius: 0.08 })
        badge(c, p, x + 0.3, top + 0.25, 0.55)
        c.text(
          p.name,
          { x: x + 1.0, y: top + 0.25, w: cw - 1.2, h: 0.55 },
          { size: 15, bold: true, color: INK, valign: "middle" },
        )
        let y = top + 1.05
        if (!p.openItems.length) {
          c.rect({ x: x + 0.3, y, w: 1.15, h: 0.3 }, { fill: "13998A", radius: 0.06 })
          c.text(
            "Clear",
            { x: x + 0.3, y, w: 1.15, h: 0.3 },
            { size: 10, bold: true, color: WHITE, align: "center", valign: "middle" },
          )
          c.text(
            "No open tasks due this month.",
            { x: x + 0.3, y: y + 0.38, w: cw - 0.6, h: 0.5 },
            { size: 12.5, color: TEXT },
          )
          return
        }
        let shown = 0
        for (const item of p.openItems) {
          const line = `${item.project}: ${item.text}${item.due ? `  (due ${fmtDay(item.due)})` : ""}`
          const lines = Math.min(3, c.lineCount(line, cw - 0.6, 12))
          const blockH = 0.38 + lines * 0.21 + 0.2
          if (y + blockH > bottom - 0.1) break
          const chip = STATUS_CHIP[item.status]
          c.rect({ x: x + 0.3, y, w: 1.15, h: 0.28 }, { fill: chip.color, radius: 0.06 })
          c.text(
            chip.label,
            { x: x + 0.3, y, w: 1.15, h: 0.28 },
            { size: 9.5, bold: true, color: WHITE, align: "center", valign: "middle" },
          )
          c.text(
            truncate(line, 160),
            { x: x + 0.3, y: y + 0.36, w: cw - 0.6, h: lines * 0.21 + 0.06 },
            { size: 12, color: TEXT },
          )
          y += blockH
          shown++
        }
        if (shown < p.openItems.length) {
          c.text(
            `+ ${p.openItems.length - shown} more`,
            { x: x + 0.3, y: bottom - 0.4, w: cw - 0.6, h: 0.3 },
            { size: 11, italic: true, color: MUTED },
          )
        }
      })
      c.text(
        "Task status when this report was generated. On-hold tasks that were already picked up again are left out.",
        {
          x: MX,
          y: 6.5,
          w: 12,
          h: 0.3,
        },
        { size: 10, italic: true, color: MUTED },
      )
      footer(c, page, total)
    })
  }

  const holidayText = r.holidays.length
    ? ` and holidays (${r.holidays.map((h) => `${h.name}, ${fmtDay(h.date)}`).join("; ")})`
    : " and company holidays"
  const blocks: [string, string[]][] = [
    [
      "Days counted",
      [
        `Monday to Friday only. Saturdays, Sundays${holidayText} are left out, as are full-day leaves.`,
      ],
    ],
    [
      "DNMS task clock",
      [
        "Each task's In Progress time, counted only between that day's check-in and check-out (09:30 - 19:30 IST without a punch).",
        "A task left In Progress after the day ended counts only on the day it started, up to its estimated hours.",
        "When two tasks ran at the same time, the time is split between them.",
      ],
    ],
    [
      "Projects",
      [
        "Ad-hoc tasks whose title names a project are counted under that project; the rest are shown as ADHOC.",
      ],
    ],
  ]
  for (const [i, group] of chunk(people, 9).entries()) {
    slides.push((c, page, total) => {
      c.addSlide(WHITE)
      header(
        c,
        "Appendix",
        i === 0 ? "How the hours were measured" : "Attendance vs. project hours (cont.)",
      )
      if (i === 0) {
        let y = 1.55
        for (const [h, items] of blocks) {
          c.text(h, { x: MX, y, w: 7.2, h: 0.32 }, { size: 14, bold: true, color: INK })
          const lines = items.reduce((n, t) => n + c.lineCount(t, 7.0, 11.5), 0)
          c.bullets(
            items,
            { x: MX, y: y + 0.38, w: 7.2, h: lines * 0.21 + items.length * 0.06 },
            { size: 11.5, color: TEXT, gap: 4 },
          )
          y += 0.38 + lines * 0.21 + items.length * 0.06 + 0.3
        }
      }
      const tx = i === 0 ? 8.2 : MX
      const tw = i === 0 ? W - MX - tx : 7
      c.text(
        "Attendance vs. project hours",
        { x: tx, y: 1.55, w: tw, h: 0.32 },
        { size: 14, bold: true, color: INK },
      )
      const colW = [tw * 0.3, tw * 0.22, tw * 0.24, tw * 0.24]
      const head: Cell[] = ["", "Days in office", "Office hours", "Project hours"].map((t) => ({
        runs: [{ text: t, bold: true, color: WHITE, size: 10.5 }],
        fill: INK,
        align: "center",
      }))
      const body: Cell[][] = group.map((p, j) => {
        const fill = j % 2 ? ZEBRA : WHITE
        const days = `${p.officeDays}${p.wfhDays ? ` + ${p.wfhDays} WFH` : ""}`
        return [
          { fill, runs: [{ text: firstName(p.name), bold: true, color: p.ink }] },
          { fill, align: "center", runs: [{ text: days }] },
          { fill, align: "center", runs: [{ text: formatHoursRound(p.officeHours) }] },
          { fill, align: "center", runs: [{ text: formatHoursRound(p.totalHours) }] },
        ]
      })
      const bottom = c.table([head, ...body], {
        x: tx,
        y: 2.0,
        colW,
        rowH: [0.5, ...group.map(() => 0.42)],
        size: 11,
        color: TEXT,
        border: LINE,
        pad: 0.08,
      })
      c.text(
        "Days in office counts days with an attendance punch; WFH days have none. Project hours can be lower than office hours: meetings and untracked work do not run a task clock.",
        {
          x: tx,
          y: bottom + 0.15,
          w: tw,
          h: 0.8,
        },
        { size: 10, italic: true, color: MUTED },
      )
      footer(c, page, total)
    })
  }

  const capped = people.flatMap((p) => p.capped.map((x) => ({ ...x, person: p })))
  for (const [i, group] of chunk(capped, 11).entries()) {
    slides.push((c, page, total) => {
      c.addSlide(WHITE)
      header(
        c,
        "Appendix",
        i === 0 ? "Tasks left In Progress (corrected)" : "Tasks left In Progress (cont.)",
      )
      const colW = [2.0, 1.1, 5.43, 1.6, 2.0]
      const head: Cell[] = ["Person", "Date", "Task", "Left running", "Counted"].map((t, k) => ({
        runs: [{ text: t, bold: true, color: WHITE, size: 10.5 }],
        fill: INK,
        align: k >= 3 ? "right" : "left",
      }))
      const body: Cell[][] = group.map((x, j) => {
        const fill = j % 2 ? ZEBRA : WHITE
        return [
          { fill, runs: [{ text: x.person.name, bold: true, color: x.person.ink }] },
          { fill, runs: [{ text: fmtDay(x.date) }] },
          { fill, runs: [{ text: truncate(`${x.project}: ${x.task}`, 70) }] },
          { fill, align: "right", runs: [{ text: `${x.leftRunningHours.toFixed(1)} h` }] },
          { fill, align: "right", runs: [{ text: `${x.countedHours.toFixed(1)} h`, bold: true }] },
        ]
      })
      const bottom = c.table([head, ...body], {
        x: MX,
        y: 1.5,
        colW,
        rowH: [0.42, ...group.map(() => 0.4)],
        size: 11,
        color: TEXT,
        border: LINE,
        pad: 0.08,
      })
      c.text(
        "These tasks stayed In Progress after work on them stopped. Each is counted on the day it started, up to its estimated hours, instead of the time it was left running.",
        {
          x: MX,
          y: bottom + 0.15,
          w: 12,
          h: 0.5,
        },
        { size: 10, italic: true, color: MUTED },
      )
      footer(c, page, total)
    })
  }

  slides.forEach((draw, i) => draw(c, i + 1, slides.length))
}

function nextMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number]
  const d = new Date(Date.UTC(y, m, 1))
  return d.toLocaleString("en-GB", { month: "long", timeZone: "UTC" })
}
