// =============================================================================
// Generate the preset avatar set into public/avatars/.
//
// For employees who would rather not upload a photo. Grouped by JOB ROLE, so a
// designer can pick something that looks like a designer: each role sets the
// clothing colour and a small prop (headphones, beret, camera, lanyard...).
//
// Built compositionally rather than hand-drawn so 42 files stay consistent.
// Deliberately flat vector: an avatar gets painted at 16px in a task card,
// where photographic detail turns to mud, and stays crisp at 96px on a profile.
//
// REPLACING THESE WITH GENERATED IMAGERY
// --------------------------------------
// Nothing in the app knows these are SVGs. To swap in AI-generated portraits,
// drop files at public/avatars/<id>.png using the same ids and change EXT below.
// See docs/avatars.md for the per-role prompts.
//
// Run with: npx tsx scripts/generate-avatars.ts
// =============================================================================

import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from "node:fs"
import { join } from "node:path"

const OUT_DIR = join(process.cwd(), "public", "avatars")

// ── Roles ───────────────────────────────────────────────────────────────────
interface Role {
  key: string
  label: string
  /** Shirt / top colour, the strongest role signal at small sizes. */
  outfit: string
  collar: string
  /** Extra drawn over the character, e.g. headphones. */
  prop: (i: number) => string
}

const NAVY = "#1e293b"

/** Over-ear headphones (dev). */
const headphones = `<g fill="${NAVY}"><path d="M28 47v-4a22 22 0 0 1 44 0v4h-4v-4a18 18 0 0 0-36 0v4Z"/><rect x="24" y="45" width="8" height="13" rx="4"/><rect x="68" y="45" width="8" height="13" rx="4"/></g>`
/** Beret (design). */
const beret = `<path d="M30 33c0-9 9-15 20-15s20 6 20 15c0 3-3 4-6 3-4-7-8-10-14-10s-11 3-14 10c-3 1-6 0-6-3Z" fill="#e11d48"/><circle cx="50" cy="16" r="3.5" fill="#e11d48"/>`
/** Round glasses (content, HR). */
const glasses = `<g fill="none" stroke="${NAVY}" stroke-width="1.8" opacity=".9"><circle cx="42" cy="46" r="6.5"/><circle cx="58" cy="46" r="6.5"/><path d="M48.5 46h3M35.5 45l-4-1.5M64.5 45l4-1.5"/></g>`
/** Camera held up to one eye (video). */
const camera = `<g><rect x="54" y="38" width="20" height="15" rx="3" fill="${NAVY}"/><circle cx="64" cy="45.5" r="5" fill="#475569"/><circle cx="64" cy="45.5" r="2.5" fill="#94a3b8"/><rect x="57" y="35" width="6" height="3" rx="1.5" fill="${NAVY}"/></g>`
/** Phone (SMO). */
const phone = `<g><rect x="66" y="52" width="12" height="19" rx="2.5" fill="${NAVY}"/><rect x="68" y="55" width="8" height="12" rx="1" fill="#38bdf8"/></g>`
/** ID lanyard (HR). */
const lanyard = `<g><path d="M42 78l6-8M58 78l-6-8" stroke="#ef4444" stroke-width="2.5" fill="none"/><rect x="44" y="78" width="12" height="16" rx="2" fill="#f8fafc"/><rect x="46" y="81" width="8" height="2" rx="1" fill="#94a3b8"/><rect x="46" y="85" width="6" height="2" rx="1" fill="#cbd5e1"/></g>`
/** Necktie (management). */
const tie = `<path d="M50 76l-4 4 4 16 4-16Z" fill="#dc2626"/><path d="M46 74h8l-4 4Z" fill="#b91c1c"/>`

const ROLES: Role[] = [
  {
    key: "web",
    label: "Web & Development",
    outfit: "#334155",
    collar: "#1e293b",
    prop: (i) => (i % 2 === 0 ? headphones : ""),
  },
  {
    key: "design",
    label: "Design",
    outfit: "#7c3aed",
    collar: "#6d28d9",
    prop: (i) => (i % 3 === 0 ? beret : ""),
  },
  {
    key: "content",
    label: "Content",
    outfit: "#0d9488",
    collar: "#0f766e",
    prop: (i) => (i % 2 === 1 ? glasses : ""),
  },
  {
    key: "video",
    label: "Video",
    outfit: "#c2410c",
    collar: "#9a3412",
    prop: (i) => (i % 3 === 0 ? camera : ""),
  },
  {
    key: "social",
    label: "Social & Marketing",
    outfit: "#db2777",
    collar: "#be185d",
    prop: (i) => (i % 3 === 0 ? phone : ""),
  },
  {
    key: "hr",
    label: "HR & Admin",
    outfit: "#0369a1",
    collar: "#075985",
    prop: (i) => (i % 2 === 0 ? lanyard : glasses),
  },
  {
    key: "lead",
    label: "Leadership",
    outfit: "#1e293b",
    collar: "#0f172a",
    prop: (i) => (i % 2 === 0 ? tie : ""),
  },
]

const PER_ROLE = 6

// ── Palettes ────────────────────────────────────────────────────────────────
const BACKGROUNDS: [string, string][] = [
  ["#e0e7ff", "#c7d2fe"],
  ["#cffafe", "#a5f3fc"],
  ["#d1fae5", "#a7f3d0"],
  ["#fef3c7", "#fde68a"],
  ["#fce7f3", "#fbcfe8"],
  ["#ede9fe", "#ddd6fe"],
]

const SKINS = ["#f5d0b9", "#eab894", "#d19a6a", "#b57a4d", "#8d5524", "#603813"]
const SKIN_SHADE = ["#e9bda3", "#dda87f", "#bf8757", "#a06a3f", "#78471c", "#4d2d0f"]
const HAIRS = ["#20160f", "#3b2418", "#6b4423", "#a0522d", "#c9a227", "#d6d3d1", "#111827"]

// ── Hair ────────────────────────────────────────────────────────────────────
// Head is an ellipse at (50, 44) rx=20 ry=23.
const HAIR_STYLES: ((c: string) => string)[] = [
  // short crop
  (c) =>
    `<path d="M30 44c0-13 9-21 20-21s20 8 20 21c0-2 1-6 0-9-2-11-10-14-20-14s-18 3-20 14c-1 3 0 7 0 9Z" fill="${c}"/>`,
  // top knot
  (c) =>
    `<path d="M30 44c0-13 9-21 20-21s20 8 20 21c0-2 1-6 0-9-2-11-10-14-20-14s-18 3-20 14c-1 3 0 7 0 9Z" fill="${c}"/><ellipse cx="50" cy="18" rx="7" ry="6" fill="${c}"/>`,
  // shoulder-length
  (c) =>
    `<path d="M30 44c0-13 9-21 20-21s20 8 20 21c0-2 1-6 0-9-2-11-10-14-20-14s-18 3-20 14c-1 3 0 7 0 9Z" fill="${c}"/><path d="M28 42c-1 16 0 24 2 30h-8c-2-9-3-21-1-31Zm44 0c1 16 0 24-2 30h8c2-9 3-21 1-31Z" fill="${c}"/>`,
  // curls
  (c) =>
    `<circle cx="36" cy="30" r="9" fill="${c}"/><circle cx="50" cy="24" r="10" fill="${c}"/><circle cx="64" cy="30" r="9" fill="${c}"/><path d="M30 42c0-10 9-17 20-17s20 7 20 17Z" fill="${c}"/>`,
  // side sweep
  (c) =>
    `<path d="M30 44c0-13 9-21 20-21s20 8 20 21c0-2 1-6 0-9-2-11-10-14-20-14s-18 3-20 14c-1 3 0 7 0 9Z" fill="${c}"/><path d="M32 34c7-8 25-10 35-2-6-2-14-1-20 2s-11 6-15 0Z" fill="#000" opacity=".2"/>`,
  // ponytail
  (c) =>
    `<path d="M30 44c0-13 9-21 20-21s20 8 20 21c0-2 1-6 0-9-2-11-10-14-20-14s-18 3-20 14c-1 3 0 7 0 9Z" fill="${c}"/><path d="M69 39c9 3 13 11 11 22-1 5-6 7-9 4s0-6 1-11-2-12-3-15Z" fill="${c}"/>`,
]

// ── Face ────────────────────────────────────────────────────────────────────
const EYES: string[] = [
  `<ellipse cx="42" cy="46" rx="2.4" ry="2.8" fill="${NAVY}"/><ellipse cx="58" cy="46" rx="2.4" ry="2.8" fill="${NAVY}"/><circle cx="42.9" cy="45" r=".9" fill="#fff"/><circle cx="58.9" cy="45" r=".9" fill="#fff"/>`,
  `<path d="M38.8 47q3.2-3.6 6.4 0M54.8 47q3.2-3.6 6.4 0" stroke="${NAVY}" stroke-width="2.1" fill="none" stroke-linecap="round"/>`,
  `<ellipse cx="42" cy="46" rx="2.8" ry="3.2" fill="${NAVY}"/><ellipse cx="58" cy="46" rx="2.8" ry="3.2" fill="${NAVY}"/><circle cx="43" cy="44.8" r="1.1" fill="#fff"/><circle cx="59" cy="44.8" r="1.1" fill="#fff"/>`,
]

const BROWS: string[] = [
  `<path d="M37.5 39.5q4.5-2.6 9 0M53.5 39.5q4.5-2.6 9 0" stroke="#000" stroke-width="1.9" fill="none" stroke-linecap="round" opacity=".55"/>`,
  `<path d="M37.5 39.5h9M53.5 39.5h9" stroke="#000" stroke-width="1.9" fill="none" stroke-linecap="round" opacity=".5"/>`,
]

const MOUTHS: string[] = [
  `<path d="M44 55.5q6 5 12 0" stroke="${NAVY}" stroke-width="2.1" fill="none" stroke-linecap="round"/>`,
  `<path d="M44 55q6 7.5 12 0Z" fill="${NAVY}"/><path d="M46.2 56.2q3.8 2.6 7.6 0Z" fill="#fb7185"/>`,
  `<path d="M45.5 56.5q4.5 3.2 9-1" stroke="${NAVY}" stroke-width="2.1" fill="none" stroke-linecap="round"/>`,
]

function character(role: Role, i: number, globalIndex: number): string {
  const bg = BACKGROUNDS[globalIndex % BACKGROUNDS.length]!
  const skinIdx = (globalIndex * 5) % SKINS.length
  const skin = SKINS[skinIdx]!
  const shade = SKIN_SHADE[skinIdx]!
  const hairColor = HAIRS[(globalIndex * 3) % HAIRS.length]!
  const hair = HAIR_STYLES[i % HAIR_STYLES.length]!
  const eyes = EYES[globalIndex % EYES.length]!
  const brows = BROWS[globalIndex % BROWS.length]!
  const mouth = MOUTHS[(globalIndex * 2) % MOUTHS.length]!

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" role="img" aria-label="${role.label} avatar ${i + 1}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient>
<clipPath id="frame"><rect width="100" height="100"/></clipPath>
</defs>
<g clip-path="url(#frame)">
<rect width="100" height="100" fill="url(#bg)"/>
<!-- torso -->
<path d="M16 100c0-14 10-22 22-25l12-4 12 4c12 3 22 11 22 25Z" fill="${role.outfit}"/>
<path d="M38 75l12 9 12-9-4-2-8 5-8-5Z" fill="${role.collar}"/>
<!-- neck -->
<path d="M43 62h14v11l-7 5-7-5Z" fill="${shade}"/>
<!-- ears -->
<ellipse cx="29" cy="46" rx="3.4" ry="4.6" fill="${skin}"/><ellipse cx="71" cy="46" rx="3.4" ry="4.6" fill="${skin}"/>
<!-- head -->
<ellipse cx="50" cy="44" rx="20" ry="23" fill="${skin}"/>
${hair(hairColor)}
${brows}
${eyes}
<!-- nose -->
<path d="M50 47v5.5q-2 1-3.2.4" stroke="${shade}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".9"/>
${mouth}
${role.prop(i)}
</g>
</svg>`
}

export const ROLE_KEYS = ROLES.map((r) => r.key)

function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  for (const f of readdirSync(OUT_DIR)) {
    if (/^av-.*\.svg$/.test(f)) unlinkSync(join(OUT_DIR, f))
  }

  let total = 0
  for (const role of ROLES) {
    for (let i = 0; i < PER_ROLE; i++) {
      const id = `av-${role.key}-${String(i + 1).padStart(2, "0")}`
      writeFileSync(join(OUT_DIR, `${id}.svg`), character(role, i, total), "utf8")
      total++
    }
  }
  console.log(`Wrote ${total} avatars across ${ROLES.length} roles to public/avatars/`)
  for (const r of ROLES) console.log(`  ${r.key.padEnd(9)} ${r.label} (${PER_ROLE})`)
}

main()
