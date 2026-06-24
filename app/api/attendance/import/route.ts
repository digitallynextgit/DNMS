import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS } from "@/lib/constants"
import { computeAttendanceStatus } from "@/features/attendance/attendance"
import { createAuditLog } from "@/lib/audit"
import type { Session } from "next-auth"

// CSV format: employee_no,date,check_in,check_out
// e.g. EMP001,2026-04-01,09:00,18:00

function parseTimeOnDate(dateStr: string, timeStr: string): Date | null {
  if (!timeStr) return null
  try {
    const [h, m] = timeStr.split(":").map(Number)
    const d = new Date(dateStr)
    d.setHours(h, m, 0, 0)
    return d
  } catch {
    return null
  }
}

export const POST = withAuth(
  PERMISSIONS.ATTENDANCE_WRITE,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, session: Session) => {
    try {
      const body = await req.json()
      const { rows, preview } = body // rows: [{employee_no, date, check_in, check_out}]

      if (!Array.isArray(rows) || rows.length === 0) {
        return NextResponse.json({ error: "No rows provided" }, { status: 400 })
      }

      const results: { row: number; success: boolean; error?: string; employeeNo?: string }[] = []

      if (preview) {
        // Validate only - don't write
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]
          // Match the file's ID against the biometric device ID first, then the
          // employee code (so a Hikvision "Employee ID" resolves either way).
          const emp = await db.employee.findFirst({
            where: { OR: [{ deviceId: row.employee_no }, { employeeNo: row.employee_no }] },
          })
          if (!emp) {
            results.push({
              row: i + 1,
              success: false,
              error: `Employee ${row.employee_no} not found`,
            })
          } else if (!row.date) {
            results.push({ row: i + 1, success: false, error: "Date is required" })
          } else {
            results.push({ row: i + 1, success: true, employeeNo: row.employee_no })
          }
        }
        return NextResponse.json({
          preview: true,
          results,
          total: rows.length,
          valid: results.filter((r) => r.success).length,
        })
      }

      // Actually import
      let imported = 0
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        try {
          // Match the file's ID against the biometric device ID first, then the
          // employee code (so a Hikvision "Employee ID" resolves either way).
          const emp = await db.employee.findFirst({
            where: { OR: [{ deviceId: row.employee_no }, { employeeNo: row.employee_no }] },
          })
          if (!emp) {
            results.push({
              row: i + 1,
              success: false,
              error: `Employee ${row.employee_no} not found`,
            })
            continue
          }

          const date = new Date(row.date)
          date.setHours(0, 0, 0, 0)
          const checkIn = parseTimeOnDate(row.date, row.check_in)
          const checkOut = parseTimeOnDate(row.date, row.check_out)

          const existing = await db.attendanceLog.findFirst({ where: { employeeId: emp.id, date } })

          // Keep existing punches when the CSV cell is blank.
          const effCheckIn = checkIn ?? existing?.checkIn ?? null
          const effCheckOut = checkOut ?? existing?.checkOut ?? null
          let workHours: number | null = null
          if (effCheckIn && effCheckOut && effCheckOut.getTime() > effCheckIn.getTime()) {
            workHours =
              Math.round(
                ((effCheckOut.getTime() - effCheckIn.getTime()) / (1000 * 60 * 60)) * 100,
              ) / 100
          }
          // Status from hours worked (half-day / absent). Late-mark not applied yet.
          const status = computeAttendanceStatus({ checkIn: effCheckIn, workHours })

          if (existing) {
            await db.attendanceLog.update({
              where: { id: existing.id },
              data: {
                checkIn: effCheckIn,
                checkOut: effCheckOut,
                workHours,
                status,
                source: "CSV",
              } as never,
            })
          } else {
            await db.attendanceLog.create({
              data: {
                employeeId: emp.id,
                date,
                checkIn: effCheckIn,
                checkOut: effCheckOut,
                workHours,
                status,
                source: "CSV",
              } as never,
            })
          }
          results.push({ row: i + 1, success: true, employeeNo: row.employee_no })
          imported++
        } catch (e) {
          results.push({ row: i + 1, success: false, error: "Unexpected error" })
        }
      }

      await createAuditLog(session, {
        action: "IMPORT",
        module: "attendance",
        entityType: "AttendanceLog",
        changes: { imported, total: rows.length },
      })

      return NextResponse.json({ imported, total: rows.length, results })
    } catch (error) {
      console.error("[ATTENDANCE_IMPORT]", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
