import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { sendEmail } from "@/lib/mailer"

// This route is called daily by a cron job (e.g., Vercel Cron, node-cron in worker.ts, or external scheduler).
// Protect it with CRON_SECRET env variable.
// Example cron: 0 9 * * * (runs at 9 AM every day)
// Call: GET /api/cron/birthdays with header Authorization: Bearer <CRON_SECRET>

export const GET = async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get("authorization")
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    const today = new Date()
    const month = today.getMonth() + 1 // 1-12
    const day = today.getDate()

    // Find all active employees whose birthday is today
    // dateOfBirth is stored as a Date - match month and day regardless of year
    const employees = await db.employee.findMany({
      where: {
        status: "ACTIVE",
        dateOfBirth: { not: null },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        dateOfBirth: true,
      },
    })

    const birthdayEmployees = employees.filter((emp) => {
      if (!emp.dateOfBirth) return false
      const dob = new Date(emp.dateOfBirth)
      return dob.getMonth() + 1 === month && dob.getDate() === day
    })

    let sent = 0
    const results: { name: string; email: string; status: string }[] = []

    for (const emp of birthdayEmployees) {
      try {
        await sendEmail({
          to: emp.email,
          subject: `Happy Birthday, ${emp.firstName}! 🎂`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; text-align: center;">
              <div style="font-size: 64px; margin: 24px 0;">🎂</div>
              <h2 style="color: #7c3aed;">Happy Birthday, ${emp.firstName}!</h2>
              <p style="font-size: 16px; color: #444;">
                Wishing you a wonderful birthday filled with joy and happiness.<br/>
                Thank you for being an amazing part of our team!
              </p>
              <p style="color: #888; font-size: 13px; margin-top: 32px;">
                - The HR Team at ${process.env.APP_NAME ?? "DNMS"}
              </p>
            </div>
          `,
          text: `Happy Birthday, ${emp.firstName}! Wishing you a wonderful day. - The HR Team`,
        })
        sent++
        results.push({ name: `${emp.firstName} ${emp.lastName}`, email: emp.email, status: "sent" })
      } catch (err) {
        results.push({
          name: `${emp.firstName} ${emp.lastName}`,
          email: emp.email,
          status: "failed",
        })
      }
    }

    return NextResponse.json({
      date: `${day}/${month}`,
      total: birthdayEmployees.length,
      sent,
      results,
    })
  } catch (error) {
    console.error("[CRON_BIRTHDAYS]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
