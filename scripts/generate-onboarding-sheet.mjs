/**
 * Generates `docs/Employee_Onboarding_Template.xlsx` - the sheet HR circulates
 * to employees for them to fill in their own details. Output is then used by
 * admin to bulk-create employees in HRMS.
 *
 * Run:  node scripts/generate-onboarding-sheet.mjs
 *
 * Re-run any time after column or dropdown changes - overwrites the file.
 */

import ExcelJS from "exceljs"
import pg from "pg"
import { mkdir, readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT = resolve(__dirname, "..", "docs", "Employee_Onboarding_Template.xlsx")
const ENV_PATH = resolve(__dirname, "..", ".env")

// Fallback list - used only if the DB is unreachable. The live list comes from
// the departments table (managed via Admin → Project Settings → Departments).
const FALLBACK_DEPARTMENTS = [
  "Video",
  "Web Development",
  "Content",
  "Design",
  "Paid Ads",
  "SEO",
  "SMO",
  "Digital PR",
  "HR",
  "Operations",
  "Finance",
  "Sales",
]

// Minimal .env loader so we can pick up DATABASE_URL without dotenv.
async function loadEnv() {
  try {
    const raw = await readFile(ENV_PATH, "utf8")
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i)
      if (!m) continue
      let val = m[2].trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      if (!(m[1] in process.env)) process.env[m[1]] = val
    }
  } catch {
    // .env missing - DATABASE_URL may already be in process.env via Vercel/etc.
  }
}

// Pulls active department names from the DB. Falls back to a hardcoded list if
// the DB can't be reached (offline / no creds) so the script still produces a sheet.
async function fetchDepartmentsFromDb() {
  if (!process.env.DATABASE_URL) {
    console.warn("[onboarding-sheet] DATABASE_URL not set - using fallback department list")
    return FALLBACK_DEPARTMENTS
  }
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 0,
    keepAlive: true,
  })
  try {
    const { rows } = await pool.query(
      "SELECT name FROM departments WHERE is_active = true ORDER BY name ASC",
    )
    if (rows.length === 0) {
      console.warn("[onboarding-sheet] DB returned 0 active departments - using fallback list")
      return FALLBACK_DEPARTMENTS
    }
    return rows.map((r) => r.name)
  } catch (err) {
    console.warn("[onboarding-sheet] DB query failed, using fallback list:", err.message)
    return FALLBACK_DEPARTMENTS
  } finally {
    await pool.end().catch(() => {})
  }
}

// ── Column definitions ────────────────────────────────────────────────────────
// Order matches the flow of the in-app Create Employee form so an admin can
// cross-reference visually. `dropdown` adds Data Validation on that column.
// Department list is injected at runtime from the DB (see fetchDepartmentsFromDb).

function buildColumns(departmentList) {
  return [
    // Sl. No
    { key: "sl", header: "Sl. No", width: 6, required: false },

    // Existing HR-system employee code (numeric, e.g. 132). NOT auto-generated.
    {
      key: "empCode",
      header: "Employee Code",
      width: 14,
      required: false,
      note: "Your existing HR-system code (e.g. 132). Leave blank if you don't have one yet.",
    },

    // Personal
    { key: "firstName", header: "First Name *", width: 18, required: true },
    { key: "lastName", header: "Last Name *", width: 18, required: true },
    {
      key: "email",
      header: "Work Email *",
      width: 32,
      required: true,
      note: "Your @digitallynext.com address",
    },
    { key: "personalEmail", header: "Personal Email", width: 28, required: false },
    { key: "phone", header: "Work Phone", width: 18, required: false },
    { key: "personalPhone", header: "Personal Phone", width: 18, required: false },
    { key: "dob", header: "Date of Birth", width: 14, required: false, note: "Format: DD-MM-YYYY" },
    {
      key: "gender",
      header: "Gender",
      width: 14,
      required: false,
      dropdown: ["Male", "Female", "Other", "Prefer not to say"],
    },
    { key: "nationality", header: "Nationality", width: 14, required: false },
    {
      key: "bloodGroup",
      header: "Blood Group",
      width: 12,
      required: false,
      dropdown: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
    },

    // Employment
    {
      key: "department",
      header: "Department",
      width: 18,
      required: false,
      dropdown: departmentList,
    },
    {
      key: "designation",
      header: "Designation",
      width: 22,
      required: false,
      note: "e.g. Junior Designer, Team Lead, Senior Manager",
    },
    {
      key: "employmentType",
      header: "Employment Type",
      width: 16,
      required: false,
      dropdown: ["Full Time", "Part Time", "Contract", "Intern"],
    },
    {
      key: "doj",
      header: "Date of Joining",
      width: 14,
      required: false,
      note: "Format: DD-MM-YYYY",
    },
    {
      key: "workLocation",
      header: "Work Location",
      width: 18,
      required: false,
      note: "e.g. Delhi HQ, Remote",
    },

    // Address - Current
    { key: "caLine1", header: "Current Addr - Line 1", width: 24, required: false },
    { key: "caLine2", header: "Current Addr - Line 2", width: 18, required: false },
    { key: "caCity", header: "Current City", width: 14, required: false },
    { key: "caState", header: "Current State", width: 14, required: false },
    { key: "caZip", header: "Current ZIP", width: 10, required: false },

    // Address - Permanent
    {
      key: "paLine1",
      header: "Permanent Addr - Line 1",
      width: 24,
      required: false,
      note: "Leave blank if same as current",
    },
    { key: "paLine2", header: "Permanent Addr - Line 2", width: 18, required: false },
    { key: "paCity", header: "Permanent City", width: 14, required: false },
    { key: "paState", header: "Permanent State", width: 14, required: false },
    { key: "paZip", header: "Permanent ZIP", width: 10, required: false },

    // Emergency
    { key: "ecName", header: "Emergency Contact Name", width: 22, required: false },
    {
      key: "ecRelation",
      header: "Emergency Contact Relation",
      width: 16,
      required: false,
      note: "e.g. Spouse, Parent, Sibling",
    },
    { key: "ecPhone", header: "Emergency Contact Phone", width: 18, required: false },
  ]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const HEADER_FILL_REQUIRED = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } }
const HEADER_FILL_OPTIONAL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF374151" } }
const HEADER_FONT = { color: { argb: "FFFFFFFF" }, bold: true, size: 11 }
const BORDER_THIN = { style: "thin", color: { argb: "FFD1D5DB" } }

function applyBorderToRange(sheet, startRow, endRow, startCol, endCol) {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      sheet.getCell(r, c).border = {
        top: BORDER_THIN,
        left: BORDER_THIN,
        bottom: BORDER_THIN,
        right: BORDER_THIN,
      }
    }
  }
}

// ── Build "Employee Details" sheet ────────────────────────────────────────────

function buildDataSheet(wb, columns) {
  const sheet = wb.addWorksheet("Employee Details", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 1 }],
  })

  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }))

  // Header styling
  const headerRow = sheet.getRow(1)
  headerRow.height = 32
  headerRow.alignment = { vertical: "middle", horizontal: "left", wrapText: true }
  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1)
    cell.font = HEADER_FONT
    cell.fill = col.required ? HEADER_FILL_REQUIRED : HEADER_FILL_OPTIONAL
    if (col.note) {
      cell.note = { texts: [{ text: col.note }], margins: { insetmode: "auto" } }
    }
  })

  // Reserve 50 blank rows + apply dropdowns, borders, auto Sl. No formula.
  const ROW_COUNT = 50
  const lastColLetter = sheet.getColumn(columns.length).letter
  for (let i = 0; i < ROW_COUNT; i++) {
    const row = sheet.getRow(i + 2)
    // Sl. No formula: shows row number only if any field in the row is filled.
    row.getCell(1).value = {
      formula: `IF(COUNTA(B${i + 2}:${lastColLetter}${i + 2})=0,"",${i + 1})`,
    }
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" }
    row.getCell(1).font = { color: { argb: "FF6B7280" }, italic: true }
  }

  // Apply data validation to dropdown columns across all 50 reserved rows.
  // Excel chokes on commas inside literal-list validation values, so any
  // department name with a comma falls back to a free-text column instead.
  columns.forEach((col, idx) => {
    if (!col.dropdown || col.dropdown.length === 0) return
    if (col.dropdown.some((v) => v.includes(","))) return
    const colLetter = sheet.getColumn(idx + 1).letter
    const range = `${colLetter}2:${colLetter}${ROW_COUNT + 1}`
    sheet.dataValidations.add(range, {
      type: "list",
      allowBlank: true,
      formulae: [`"${col.dropdown.join(",")}"`],
      showErrorMessage: true,
      errorStyle: "warning",
      errorTitle: "Invalid choice",
      error: `Please pick one of: ${col.dropdown.join(", ")}`,
    })
  })

  applyBorderToRange(sheet, 1, ROW_COUNT + 1, 1, columns.length)
  return sheet
}

// ── Build "Instructions" sheet ────────────────────────────────────────────────

function buildInstructionsSheet(wb) {
  const sheet = wb.addWorksheet("Instructions", {
    properties: { tabColor: { argb: "FF059669" } },
  })

  sheet.getColumn(1).width = 110

  const lines = [
    { text: "Employee Onboarding - Information Collection", style: "h1" },
    { text: "", style: "blank" },
    { text: "How to fill this sheet", style: "h2" },
    { text: '1. Open the "Employee Details" tab.', style: "p" },
    { text: "2. Each row = one employee. Fill in one row for yourself.", style: "p" },
    {
      text: "3. Columns with a dark-blue header are REQUIRED. Dark-grey headers are optional.",
      style: "p",
    },
    {
      text: "4. Cells with a small red corner have a tooltip - hover for format hints.",
      style: "p",
    },
    {
      text: "5. Dropdown columns (Gender, Blood Group, Department, Employment Type) restrict input - pick from the list.",
      style: "p",
    },
    { text: "6. Dates must be in DD-MM-YYYY format (e.g. 14-08-1998).", style: "p" },
    {
      text: "7. If your permanent address is the same as your current address, leave the permanent columns blank.",
      style: "p",
    },
    { text: "", style: "blank" },
    { text: "Gmail App Password - DO NOT put it here", style: "h2_warn" },
    {
      text: "Your Gmail App Password must NEVER be written into this sheet. Once admin creates your HRMS account, log in and set it via:",
      style: "p",
    },
    { text: "      Profile → Security → Gmail App Password → Save", style: "p_mono" },
    {
      text: "It is stored encrypted on the server and is never shown back to anyone - including admins.",
      style: "p",
    },
    { text: "", style: "blank" },
    { text: "What admin will fill on your behalf", style: "h2" },
    { text: "• Employee Number (auto-generated)", style: "p" },
    { text: "• Manager assignment", style: "p" },
    { text: "• Probation end date", style: "p" },
    { text: "• Role & permissions", style: "p" },
    { text: "• Initial login password (will be shared with you privately)", style: "p" },
    { text: "", style: "blank" },
    { text: "Questions?", style: "h2" },
    { text: "Contact HR at dndesignsbfg@gmail.com.", style: "p" },
  ]

  const STYLES = {
    h1: { font: { bold: true, size: 18, color: { argb: "FF1E3A8A" } } },
    h2: { font: { bold: true, size: 13, color: { argb: "FF111827" } } },
    h2_warn: { font: { bold: true, size: 13, color: { argb: "FFB91C1C" } } },
    p: { font: { size: 11, color: { argb: "FF374151" } }, alignment: { wrapText: true } },
    p_mono: { font: { size: 11, color: { argb: "FF111827" }, name: "Consolas" } },
    blank: {},
  }

  lines.forEach((line, idx) => {
    const row = sheet.getRow(idx + 2)
    const cell = row.getCell(2)
    cell.value = line.text
    const style = STYLES[line.style] ?? {}
    if (style.font) cell.font = style.font
    if (style.alignment) cell.alignment = style.alignment
    if (line.style === "h1") row.height = 28
    if (line.style === "h2" || line.style === "h2_warn") row.height = 22
  })

  sheet.getColumn(2).width = 110
  return sheet
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  await loadEnv()
  await mkdir(dirname(OUTPUT), { recursive: true })

  const departments = await fetchDepartmentsFromDb()
  console.log(
    `[onboarding-sheet] Using ${departments.length} department(s):`,
    departments.join(", "),
  )
  const columns = buildColumns(departments)

  const wb = new ExcelJS.Workbook()
  wb.creator = "HRMS"
  wb.created = new Date()
  wb.lastModifiedBy = "HRMS"
  wb.title = "Employee Onboarding Template"

  buildInstructionsSheet(wb)
  buildDataSheet(wb, columns)

  // Force "Instructions" first
  wb.worksheets.sort((a, b) => (a.name === "Instructions" ? -1 : 1))

  await wb.xlsx.writeFile(OUTPUT)
  console.log(`Wrote ${OUTPUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
