import "server-only"

import { NextResponse } from "next/server"
import { ZodError } from "zod"
import { AppError } from "@/lib/errors"

/** One error shape for the metrics routes: validation 422, known errors as thrown, the rest 500. */
export function metricsFailure(e: unknown, tag: string) {
  if (e instanceof ZodError) {
    return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 422 })
  }
  if (e instanceof AppError) {
    return NextResponse.json({ error: e.message }, { status: e.statusCode })
  }
  console.error(`[METRICS_${tag}]`, e)
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
}
