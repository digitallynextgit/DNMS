import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { withAuth } from "@/lib/permissions"
import { PERMISSIONS } from "@/lib/constants"
import bcrypt from "bcryptjs"
import type { Session } from "next-auth"

// CSV columns (header-matched, case-insensitive): first_name, last_name, email
// (required) + optional employee_code, phone, department, designation,
// date_of_joining (YYYY-MM-DD or DD-MM-YYYY).

interface ParsedRow {
  firstName: string
  lastName: string
  email: string
  employeeNo: string
  phone: string
  department: string
  designation: string
  dateOfJoining: string
}

const ALIASES: Record<keyof ParsedRow, string[]> = {
  firstName: ["first name", "first_name", "firstname", "first"],
  lastName: ["last name", "last_name", "lastname", "last", "surname"],
  email: ["email", "work email", "email address", "e-mail"],
  employeeNo: ["employee code", "employee_code", "employee no", "employee id", "code", "emp code"],
  phone: ["phone", "mobile", "contact", "work phone", "phone number"],
  department: ["department", "dept"],
  designation: ["designation", "title", "role", "position"],
  dateOfJoining: ["date of joining", "doj", "joining date", "date_of_joining"],
}

function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "")
  const rows: string[][] = []
  let row: string[] = []
  let cur = ""
  let q = false
  const endCell = () => {
    row.push(cur.trim())
    cur = ""
  }
  const endRow = () => {
    endCell()
    if (row.some((c) => c !== "")) rows.push(row)
    row = []
  }
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (q) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cur += '"'
          i++
        } else q = false
      } else cur += c
    } else if (c === '"') q = true
    else if (c === ",") endCell()
    else if (c === "\r") {
      if (src[i + 1] === "\n") i++
      endRow()
    } else if (c === "\n") endRow()
    else cur += c
  }
  if (cur !== "" || row.length) endRow()
  return rows
}

function toIsoDate(s: string): string | null {
  if (!s) return null
  const iso = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`
  const dmy = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`
  return null
}

function mapRows(grid: string[][]): ParsedRow[] {
  if (grid.length < 2) return []
  const header = grid[0].map((h) => h.trim().toLowerCase())
  const col: Partial<Record<keyof ParsedRow, number>> = {}
  for (const [field, names] of Object.entries(ALIASES) as [keyof ParsedRow, string[]][]) {
    const idx = header.findIndex((h) => names.includes(h))
    if (idx >= 0) col[field] = idx
  }
  return grid.slice(1).map((cells) => {
    const get = (f: keyof ParsedRow) => (col[f] != null ? (cells[col[f]!] ?? "").trim() : "")
    return {
      firstName: get("firstName"),
      lastName: get("lastName"),
      email: get("email"),
      employeeNo: get("employeeNo"),
      phone: get("phone"),
      department: get("department"),
      designation: get("designation"),
      dateOfJoining: get("dateOfJoining"),
    }
  })
}

export const POST = withAuth(
  PERMISSIONS.EMPLOYEE_WRITE,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const form = await req.formData()
      const file = form.get("file")
      const preview = form.get("preview") === "true"
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
      }

      const rows = mapRows(parseCsv(Buffer.from(await file.arrayBuffer()).toString("utf8")))
      if (rows.length === 0) {
        return NextResponse.json({ error: "No data rows found" }, { status: 400 })
      }

      const [departments, designations] = await Promise.all([
        db.department.findMany({ select: { id: true, name: true } }),
        db.designation.findMany({ select: { id: true, title: true } }),
      ])
      const deptByName = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]))
      const desigByTitle = new Map(designations.map((d) => [d.title.toLowerCase(), d.id]))

      const results: { row: number; ok: boolean; error?: string; name?: string }[] = []
      const passwordHash = preview ? "" : await bcrypt.hash("Admin@123", 12)
      const employeeRole = preview
        ? null
        : await db.role.findFirst({ where: { name: "employee" }, select: { id: true } })

      let imported = 0
      const seenEmails = new Set<string>()

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        const label = `${r.firstName} ${r.lastName}`.trim() || r.email
        try {
          if (!r.firstName || !r.email) {
            results.push({
              row: i + 1,
              ok: false,
              error: "First name and email are required",
              name: label,
            })
            continue
          }
          if (seenEmails.has(r.email.toLowerCase())) {
            results.push({ row: i + 1, ok: false, error: "Duplicate email in file", name: label })
            continue
          }
          seenEmails.add(r.email.toLowerCase())

          const clashEmail = await db.employee.findUnique({
            where: { email: r.email },
            select: { id: true },
          })
          if (clashEmail) {
            results.push({ row: i + 1, ok: false, error: "Email already exists", name: label })
            continue
          }
          if (r.employeeNo) {
            const clashNo = await db.employee.findUnique({
              where: { employeeNo: r.employeeNo },
              select: { id: true },
            })
            if (clashNo) {
              results.push({
                row: i + 1,
                ok: false,
                error: "Employee code already exists",
                name: label,
              })
              continue
            }
          }

          if (preview) {
            results.push({ row: i + 1, ok: true, name: label })
            continue
          }

          const employeeNo = r.employeeNo || `EMP-${Date.now()}-${i}`
          const created = await db.employee.create({
            data: {
              employeeNo,
              firstName: r.firstName,
              lastName: r.lastName,
              email: r.email,
              phone: r.phone || null,
              departmentId: deptByName.get(r.department.toLowerCase()) ?? null,
              designationId: desigByTitle.get(r.designation.toLowerCase()) ?? null,
              dateOfJoining: toIsoDate(r.dateOfJoining)
                ? new Date(`${toIsoDate(r.dateOfJoining)}T00:00:00.000Z`)
                : null,
              employmentType: "FULL_TIME",
              status: "ACTIVE",
              isActive: true,
              passwordHash,
              emailVerified: new Date(),
            },
          })
          if (employeeRole) {
            await db.employeeRole.create({
              data: { employeeId: created.id, roleId: employeeRole.id },
            })
          }
          imported++
          results.push({ row: i + 1, ok: true, name: label })
        } catch {
          results.push({ row: i + 1, ok: false, error: "Unexpected error", name: label })
        }
      }

      return NextResponse.json({
        preview,
        total: rows.length,
        valid: results.filter((r) => r.ok).length,
        imported,
        results,
      })
    } catch (error) {
      console.error("[EMPLOYEES_IMPORT]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
