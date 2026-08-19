import { NextRequest } from "next/server"
import { handlePunchPush, handlePunchProbe } from "@/features/attendance/server/punch-hook"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST /api/attendance/hook?key=<secret>   (or Basic auth)
export const POST = (req: NextRequest) => handlePunchPush(req)
export const GET = (req: NextRequest) => handlePunchProbe(req)
