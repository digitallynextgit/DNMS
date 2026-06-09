import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { createNotification } from "@/lib/notifications"

// Notifies people about documents expiring within the next 30 days.
//   - Personal (employee) documents → notify the employee.
//   - Company documents → notify whoever uploaded them.
// Run daily. Auth: Authorization: Bearer <CRON_SECRET>

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const now = new Date()
    const horizon = new Date(now)
    horizon.setDate(horizon.getDate() + 30)

    const employeeDocs = await db.employeeDocument.findMany({
      where: { expiresAt: { gte: now, lte: horizon } },
      select: { id: true, title: true, expiresAt: true, employeeId: true },
    })
    const companyDocs = await db.document.findMany({
      where: { expiresAt: { gte: now, lte: horizon } },
      select: { id: true, title: true, expiresAt: true, uploadedById: true },
    })

    let notified = 0
    const fmt = (d: Date | null) => (d ? new Date(d).toDateString() : "")

    for (const doc of employeeDocs) {
      await createNotification({
        employeeId: doc.employeeId,
        title: "Document expiring soon",
        message: `Your document "${doc.title}" expires on ${fmt(doc.expiresAt)}. Please renew it.`,
        type: "warning",
        link: "/profile",
      })
      notified++
    }
    for (const doc of companyDocs) {
      if (!doc.uploadedById) continue
      await createNotification({
        employeeId: doc.uploadedById,
        title: "Company document expiring soon",
        message: `"${doc.title}" expires on ${fmt(doc.expiresAt)}.`,
        type: "warning",
        link: "/documents",
      })
      notified++
    }

    return NextResponse.json({
      success: true,
      employeeDocs: employeeDocs.length,
      companyDocs: companyDocs.length,
      notified,
    })
  } catch (error) {
    console.error("[DOCUMENT_EXPIRY_CRON]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
