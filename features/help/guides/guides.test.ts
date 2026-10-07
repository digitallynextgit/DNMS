import { describe, expect, it } from "vitest"
import { ADMIN_ITEMS, COMPANY_ITEMS, EMPLOYEE_ITEMS, HRMS_ITEMS, projectItems } from "@/lib/nav"
import { HELP_GROUPS, HELP_GUIDES } from "."
import type { HelpGuide, L10n } from "../types"

// Guards for the guide content itself - cheap mistakes that would otherwise only
// show up as a broken page, a missing translation or a marker pointing nowhere.

const DEVANAGARI = /[ऀ-ॿ]/

function allText(g: HelpGuide): { where: string; text: L10n }[] {
  const out: { where: string; text: L10n }[] = [
    { where: `${g.slug}.title`, text: g.title },
    { where: `${g.slug}.summary`, text: g.summary },
  ]
  for (const s of g.sections) {
    const at = `${g.slug}#${s.id}`
    out.push({ where: `${at}.title`, text: s.title })
    if (s.intro) out.push({ where: `${at}.intro`, text: s.intro })
    s.steps?.forEach((st, i) => out.push({ where: `${at}.step${i + 1}`, text: st.text }))
    s.tips?.forEach((t, i) => out.push({ where: `${at}.tip${i + 1}`, text: t }))
    s.faq?.forEach((f, i) => {
      out.push({ where: `${at}.faq${i + 1}.q`, text: f.q })
      out.push({ where: `${at}.faq${i + 1}.a`, text: f.a })
    })
  }
  return out
}

const navPaths = new Set<string>()
for (const items of [EMPLOYEE_ITEMS, COMPANY_ITEMS, projectItems(true), HRMS_ITEMS, ADMIN_ITEMS]) {
  for (const item of items) {
    if (item.href) navPaths.add(item.href)
    for (const c of item.children ?? []) navPaths.add(c.href)
  }
}

describe("help guides", () => {
  it("has guides", () => {
    expect(HELP_GUIDES.length).toBeGreaterThan(0)
  })

  it("uses unique, url-safe slugs", () => {
    const slugs = HELP_GUIDES.map((g) => g.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it("files every guide under a listed group", () => {
    const groups = new Set(HELP_GROUPS.map((g) => g.id))
    for (const g of HELP_GUIDES) expect(groups.has(g.group), g.slug).toBe(true)
  })

  it("points every guide at a page that is in the sidebar", () => {
    for (const g of HELP_GUIDES) {
      if (g.href) expect(navPaths.has(g.href), `${g.slug} href ${g.href}`).toBe(true)
    }
  })

  it("gives every section a unique anchor", () => {
    for (const g of HELP_GUIDES) {
      const ids = g.sections.map((s) => s.id)
      expect(new Set(ids).size, g.slug).toBe(ids.length)
    }
  })

  it("uses each screenshot id once, kebab-case", () => {
    const ids: string[] = []
    for (const g of HELP_GUIDES)
      for (const s of g.sections) for (const st of s.steps ?? []) if (st.shot) ids.push(st.shot.id)
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
    expect(dupes).toEqual([])
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it("writes every sentence in English and Hindi", () => {
    const problems: string[] = []
    for (const g of HELP_GUIDES) {
      for (const { where, text } of allText(g)) {
        if (!text.en.trim()) problems.push(`${where}: empty English`)
        if (!text.hi.trim()) problems.push(`${where}: empty Hindi`)
        else if (!DEVANAGARI.test(text.hi)) problems.push(`${where}: Hindi has no Devanagari`)
      }
    }
    expect(problems).toEqual([])
  })

  it("uses plain hyphens, not em dashes", () => {
    const problems: string[] = []
    for (const g of HELP_GUIDES)
      for (const { where, text } of allText(g))
        if (text.en.includes("—") || text.hi.includes("—")) problems.push(where)
    expect(problems).toEqual([])
  })

  it("only refers to highlight numbers the screenshot has", () => {
    // A "(n)" in a step points at the n-th box of the latest screenshot in its section.
    const problems: string[] = []
    for (const g of HELP_GUIDES) {
      for (const s of g.sections) {
        let boxes = 0
        s.steps?.forEach((st, i) => {
          if (st.shot) boxes = st.shot.highlight?.length ?? 0
          for (const lang of ["en", "hi"] as const) {
            for (const m of st.text[lang].matchAll(/\((\d{1,2})\)/g)) {
              if (Number(m[1]) > boxes) {
                problems.push(
                  `${g.slug}#${s.id} step ${i + 1} (${lang}): (${m[1]}) but ${boxes} box(es)`,
                )
              }
            }
          }
        })
      }
    }
    expect(problems).toEqual([])
  })

  it("starts every screenshot path at the app root", () => {
    for (const g of HELP_GUIDES)
      for (const s of g.sections)
        for (const st of s.steps ?? [])
          if (st.shot) expect(st.shot.path.startsWith("/"), st.shot.id).toBe(true)
  })
})
