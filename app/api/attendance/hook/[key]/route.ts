import { NextRequest } from "next/server"
import { handlePunchPush, handlePunchProbe } from "@/features/attendance/server/punch-hook"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Secret as a path segment: some firmware can't store a "?" in its listening URL.
export const POST = async (req: NextRequest, ctx: { params: Promise<{ key: string }> }) =>
  handlePunchPush(req, (await ctx.params).key)

export const GET = async (req: NextRequest, ctx: { params: Promise<{ key: string }> }) =>
  handlePunchProbe(req, (await ctx.params).key)
