import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import {
  reportType,
  reportSection,
  sectionsFor,
  type ReportType,
  type ReportSection,
} from "../features/projects/lib/report-options"

const db = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })),
})

function buildSystemPrompt(type: ReportType, sections: ReportSection[]) {
  const def = reportType(type)
  const chosen = sections.map(reportSection).filter(Boolean) as NonNullable<
    ReturnType<typeof reportSection>
  >[]
  const headings = chosen.map((s) => `**${s.heading}**`).join(", ")
  const rules = chosen.map((s) => `- **${s.heading}**: ${s.instruction}`).join("\n")
  const words = Math.max(90, chosen.length * 45)
  return `You are a delivery operations analyst.
REPORT TYPE: ${def.label}. ${def.lens}
Rules:
- Use ONLY the data provided.
- Use EXACTLY these sections, in this order, wrapped in bold like **Overall**: ${headings}.
- Do not add or omit sections.
- Under each use 1 to 4 "- " bullets.
- Roughly ${words} to ${words + 80} words.
What each section must contain:
${rules}`
}

async function main() {
  const tasks = await db.projectTask.findMany({
    select: {
      title: true,
      status: true,
      dueDate: true,
      assignee: { select: { firstName: true, lastName: true } },
      team: { select: { name: true } },
      project: { select: { name: true } },
    },
  })
  type Task = (typeof tasks)[number]
  const who = (t: Task) =>
    t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}`.trim() : "Unassigned"

  for (const type of ["portfolio", "project", "team", "individual"] as ReportType[]) {
    const def = reportType(type)
    const key = (t: Task) =>
      def.groupBy === "project"
        ? (t.project?.name ?? "No project")
        : def.groupBy === "team"
          ? (t.team?.name ?? "No team")
          : def.groupBy === "employee"
            ? who(t)
            : "All"
    const groups = new Map<string, number>()
    for (const t of tasks) groups.set(key(t), (groups.get(key(t)) ?? 0) + 1)
    console.log(`\n${type.toUpperCase()}  groupBy=${def.groupBy} -> ${groups.size} groups`)
    console.log(
      "  " +
        [...groups.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([n, c]) => `${n}:${c}`)
          .join("  "),
    )
    console.log(
      "  sections offered:",
      sectionsFor(type)
        .map((s) => s.key)
        .join(","),
    )
  }

  // Live AI check on the two new types, every section switched on.
  for (const type of ["team", "individual"] as ReportType[]) {
    const secs = sectionsFor(type).map((s) => s.key)
    const sys = buildSystemPrompt(type, secs)
    const def = reportType(type)
    const key = (t: Task) => (def.groupBy === "team" ? (t.team?.name ?? "No team") : who(t))
    const g = new Map<string, { a: number; d: number; o: number }>()
    for (const t of tasks) {
      const k = key(t)
      const b = g.get(k) ?? { a: 0, d: 0, o: 0 }
      b.a++
      if (t.status === "DONE") b.d++
      if (t.status !== "DONE" && t.dueDate && new Date(t.dueDate) < new Date()) b.o++
      g.set(k, b)
    }
    const user = [
      "Projects: all in scope. All dates.",
      `Total tasks: ${tasks.length}.`,
      "",
      `Per ${def.groupBy} (assigned / done / overdue):`,
      ...[...g.entries()].map(([n, b]) => `- ${n}: ${b.a} / ${b.d} / ${b.o}`),
    ].join("\n")

    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        temperature: 0.3,
        max_tokens: Math.min(1600, 300 + secs.length * 160),
      }),
    })
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const text = body?.choices?.[0]?.message?.content ?? ""
    const got = [...text.matchAll(/^\*\*(.+?)\*\*/gm)].map((m) => m[1])
    const want = secs.map((s) => reportSection(s)!.heading)
    console.log(`\n--- ${type}: HTTP ${res.status}, ${text.trim().split(/\s+/).length} words`)
    console.log("  want:", want.join(" | "))
    console.log("  got: ", got.join(" | "))
    console.log("  headings match:", JSON.stringify(got) === JSON.stringify(want) ? "YES" : "NO")
  }
}
main().finally(() => db.$disconnect())
