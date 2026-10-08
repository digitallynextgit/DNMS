"use client"

import { useCallback, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

export interface SyncProgressState {
  phase: "idle" | "probing" | "fetching" | "writing" | "done" | "error"
  /** 0-100, from the known total window count. */
  percent: number
  windowsDone: number
  windowsTotal: number
  currentRange?: string
  punches: number
  elapsedMs: number
  etaMs: number | null
  message?: string
  error?: string
}

const IDLE: SyncProgressState = {
  phase: "idle",
  percent: 0,
  windowsDone: 0,
  windowsTotal: 0,
  punches: 0,
  elapsedMs: 0,
  etaMs: null,
}

/** "1m 42s" / "12s" / "-" */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !isFinite(ms)) return "-"
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`
}

/** Runs a device sync via the streaming (NDJSON) endpoint, exposing real percent, elapsed time
 *  and ETA. */
export function useSyncProgress() {
  const qc = useQueryClient()
  const [progress, setProgress] = useState<SyncProgressState>(IDLE)
  const abortRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => setProgress(IDLE), [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setProgress(IDLE)
  }, [])

  const start = useCallback(
    async (deviceId: string, opts: { employeeNo?: string; full?: boolean } = {}) => {
      const params = new URLSearchParams()
      if (opts.employeeNo) params.set("employeeNo", opts.employeeNo)
      if (opts.full) params.set("full", "1")
      const qs = params.toString()

      const controller = new AbortController()
      abortRef.current = controller
      setProgress({ ...IDLE, phase: "probing", message: "Contacting device…" })

      try {
        const res = await fetch(
          `/api/attendance/devices/${deviceId}/sync/stream${qs ? `?${qs}` : ""}`,
          { method: "POST", signal: controller.signal },
        )
        if (!res.ok || !res.body) {
          // Only trust a JSON error body; an HTML error page would flood the UI with markup.
          const contentType = res.headers.get("content-type") ?? ""
          let msg = ""
          if (contentType.includes("application/json")) {
            const body = (await res.json().catch(() => null)) as { error?: string } | null
            msg = body?.error ?? ""
          }
          throw new Error(
            msg || `Sync failed (HTTP ${res.status}). Check the server logs for details.`,
          )
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        // NDJSON: parse up to the last newline and buffer the rest (chunks can split lines).
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.trim()) continue
            let msg: Record<string, unknown>
            try {
              msg = JSON.parse(line)
            } catch {
              continue // partial/garbled line - skip it
            }

            if (msg.type === "progress") {
              const windowsDone = Number(msg.windowsDone ?? 0)
              const windowsTotal = Number(msg.windowsTotal ?? 0)
              setProgress({
                phase: (msg.phase as SyncProgressState["phase"]) ?? "fetching",
                percent: windowsTotal > 0 ? Math.round((windowsDone / windowsTotal) * 100) : 0,
                windowsDone,
                windowsTotal,
                currentRange: msg.currentRange as string | undefined,
                punches: Number(msg.punches ?? 0),
                elapsedMs: Number(msg.elapsedMs ?? 0),
                etaMs: msg.etaMs == null ? null : Number(msg.etaMs),
                message: msg.message as string | undefined,
              })
            } else if (msg.type === "done") {
              setProgress((p) => ({
                ...p,
                phase: "done",
                percent: 100,
                etaMs: 0,
                message: msg.message as string,
              }))
              toast.success(msg.message as string)
              if (msg.completed === false) {
                toast.warning("Some device windows failed - re-run the sync to fill the gaps.")
              }
              qc.invalidateQueries({ queryKey: ["attendance-devices"] })
              qc.invalidateQueries({ queryKey: ["employee-sync-summary"] })
              qc.invalidateQueries({ queryKey: ["attendance-logs"] })
              qc.invalidateQueries({ queryKey: ["attendance-directory"] })
            } else if (msg.type === "error") {
              setProgress((p) => ({ ...p, phase: "error", error: msg.error as string }))
              toast.error(msg.error as string)
            }
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return // user cancelled - not an error
        const message = err instanceof Error ? err.message : String(err)
        setProgress((p) => ({ ...p, phase: "error", error: message }))
        toast.error(message)
      } finally {
        abortRef.current = null
      }
    },
    [qc],
  )

  const isRunning =
    progress.phase === "probing" || progress.phase === "fetching" || progress.phase === "writing"

  return { progress, isRunning, start, cancel, reset }
}
