import { NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { withSession } from "@/server/api-handler"
import { encrypt } from "@/lib/crypto"
import bcrypt from "bcryptjs"
import type { Session } from "next-auth"

export const GET = withSession(async (_req: NextRequest, _ctx: unknown, session: Session) => {
  try {
    const employee = await db.employee.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        employeeNo: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        currentAddress: true,
        dateOfBirth: true,
        profilePhoto: true,
        emergencyContact: true,
        department: { select: { name: true } },
        designation: { select: { title: true } },
        status: true,
        dateOfJoining: true,
        gmailAppPassword: true, // selected to derive the flag, never returned raw
      },
    })
    if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const { gmailAppPassword, ...safe } = employee
    return NextResponse.json({ data: { ...safe, hasGmailAppPassword: !!gmailAppPassword } })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})

export const PATCH = withSession(async (req: NextRequest, _ctx: unknown, session: Session) => {
  try {
    const body = await req.json()

    // Allow only self-service fields
    const data: Record<string, unknown> = {}
    if (body.phone !== undefined) data.phone = body.phone || null
    if (body.currentAddress !== undefined) data.currentAddress = body.currentAddress || null
    if (body.emergencyContact !== undefined) data.emergencyContact = body.emergencyContact || null

    // Gmail App Password - strip spaces, must be exactly 16 chars when present.
    if (body.gmailAppPassword !== undefined) {
      const raw =
        typeof body.gmailAppPassword === "string" ? body.gmailAppPassword.replace(/\s+/g, "") : ""
      if (raw === "") {
        data.gmailAppPassword = null
      } else if (raw.length !== 16) {
        return NextResponse.json(
          { error: "Gmail App Password must be 16 characters" },
          { status: 400 },
        )
      } else {
        data.gmailAppPassword = encrypt(raw)
      }
    }

    // Password change
    if (body.currentPassword && body.newPassword) {
      const employee = await db.employee.findUnique({
        where: { id: session.user.id },
        select: { passwordHash: true },
      })
      if (!employee?.passwordHash)
        return NextResponse.json(
          { error: "Cannot change password for this account" },
          { status: 400 },
        )
      const valid = await bcrypt.compare(body.currentPassword, employee.passwordHash)
      if (!valid)
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })
      if (body.newPassword.length < 8)
        return NextResponse.json(
          { error: "Password must be at least 8 characters" },
          { status: 400 },
        )
      data.passwordHash = await bcrypt.hash(body.newPassword, 12)
    }

    const updated = await db.employee.update({
      where: { id: session.user.id },
      data,
      select: {
        id: true,
        phone: true,
        currentAddress: true,
        emergencyContact: true,
        // Expose only whether a password is set, never the value itself.
      },
    })

    // Tell the client whether they currently have an App Password on file.
    const hasGmailAppPassword = !!(
      await db.employee.findUnique({
        where: { id: session.user.id },
        select: { gmailAppPassword: true },
      })
    )?.gmailAppPassword

    return NextResponse.json({ data: { ...updated, hasGmailAppPassword } })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})
