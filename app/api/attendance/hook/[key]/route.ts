import { NextRequest } from "next/server"
import { handlePunchPush, handlePunchProbe } from "@/features/attendance/server/punch-hook"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST /api/attendance/hook/<secret>
//
// The same hook with the secret as a path segment, because some firmware will
// not store a "?" in its HTTP Listening URL field - and then there is nowhere
// else to put it. Identical checks either way.
export const POST = async (req: NextRequest, ctx: { params: Promise<{ key: string }> }) =>
  handlePunchPush(req, (await ctx.params).key)

export const GET = async (req: NextRequest, ctx: { params: Promise<{ key: string }> }) =>
  handlePunchProbe(req, (await ctx.params).key)
