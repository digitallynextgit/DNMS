// API route response shape. Server actions use server/action-result.ts instead (also exports ok/fail).

import { NextResponse } from "next/server"

type Success<T> = { success: true; data: T }
type Failure = {
  success: false
  error: { code: string; message: string; details?: unknown }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<Success<T>>({ success: true, data }, init)
}

export function fail(code: string, message: string, status = 400, details?: unknown) {
  return NextResponse.json<Failure>(
    { success: false, error: { code, message, details } },
    { status },
  )
}
