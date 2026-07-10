import { NextResponse } from "next/server"
import { db } from "@/server/db"
import { withAuth } from "@/server/api-handler"
import { PERMISSIONS, HIDDEN_ROLES } from "@/lib/constants"

// Per-employee attendance summary for the device "sync by employee" panel:
// how many days are on record, present/half counts, and the latest punch day -
// so HR can see at a glance who's behind and sync just that person.
export const GET = withAuth(PERMISSIONS.ATTENDANCE_WRITE, async () => {
  const employees = await db.employee.findMany({
    where: {
      isActive: true,
      status: "ACTIVE",
      NOT: { employeeRoles: { some: { role: { name: { in: [...HIDDEN_ROLES] } } } } },
    },
    select: {
      id: true,
      employeeNo: true,
      deviceId: true,
      firstName: true,
      lastName: true,
      profilePhoto: true,
      designation: { select: { title: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  })

  const ids = employees.map((e) => e.id)
  const [totals, presents, halfs] = await Promise.all([
    db.attendanceLog.groupBy({
      by: ["employeeId"],
      where: { employeeId: { in: ids } },
      _count: { _all: true },
      _max: { date: true, checkIn: true },
    }),
    db.attendanceLog.groupBy({
      by: ["employeeId"],
      where: { employeeId: { in: ids }, status: "PRESENT" },
      _count: { _all: true },
    }),
    db.attendanceLog.groupBy({
      by: ["employeeId"],
      where: { employeeId: { in: ids }, status: "HALF_DAY" },
      _count: { _all: true },
    }),
  ])

  const totalBy = new Map(totals.map((t) => [t.employeeId, t]))
  const presentBy = new Map(presents.map((p) => [p.employeeId, p._count._all]))
  const halfBy = new Map(halfs.map((h) => [h.employeeId, h._count._all]))

  const data = employees.map((e) => {
    const t = totalBy.get(e.id)
    return {
      id: e.id,
      employeeNo: e.employeeNo,
      deviceId: e.deviceId,
      firstName: e.firstName,
      lastName: e.lastName,
      profilePhoto: e.profilePhoto,
      designation: e.designation?.title ?? null,
      hasCode: !!(e.deviceId || e.employeeNo),
      totalDays: t?._count._all ?? 0,
      presentDays: presentBy.get(e.id) ?? 0,
      halfDays: halfBy.get(e.id) ?? 0,
      lastPunchDate: t?._max.date ? t._max.date.toISOString().slice(0, 10) : null,
    }
  })

  return NextResponse.json({ data })
})
