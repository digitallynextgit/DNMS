"use client"

/**
 * The voice-note recorder, laid out the way the phone apps do it: while you are
 * recording, the whole composer becomes a recording bar - bin on the left, a
 * running clock, a live waveform, pause, and send.
 *
 * Deliberately NOT push-to-hold. On a desktop a long mouse hold is
 * uncomfortable, and one accidental mouse-up mid-sentence loses the recording
 * with no way to get it back. Tap to start, tap to send.
 *
 * The bars drawn here are not decoration: the same peaks are handed to the
 * caller and stored with the clip, so the bubble in the thread shows the real
 * shape of what was said rather than a random pattern.
 */

import * as React from "react"
import { Mic, Trash2, Send, Loader2, Pause, Play } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

/** mm:ss - a voice note is never long enough to need hours. */
function clock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = Math.floor(totalSeconds % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}

/** How many bars fit in the bar before older ones scroll off the left edge. */
const LIVE_BARS = 56
/** Peaks kept for the sent clip - enough shape for a bubble, small enough to store. */
const STORED_PEAKS = 64
/** Amplitude sampled ~14x/second: fast enough to look live, slow enough to read. */
const SAMPLE_MS = 70

export function VoiceRecorder({
  onSend,
  onActiveChange,
  disabled,
}: {
  onSend: (blob: Blob, durationSec: number, waveform: number[]) => Promise<void> | void
  /** Lets the composer hide the text field and hand the whole row over. */
  onActiveChange?: (active: boolean) => void
  disabled?: boolean
}) {
  const [state, setState] = React.useState<"idle" | "recording" | "paused" | "sending">("idle")
  const [elapsed, setElapsed] = React.useState(0)
  const [live, setLive] = React.useState<number[]>([])

  const recorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<BlobPart[]>([])
  const audioCtxRef = React.useRef<AudioContext | null>(null)
  const analyserRef = React.useRef<AnalyserNode | null>(null)
  const sampleTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const clockTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  /** Every peak since the start - `live` is only the visible tail of this. */
  const allPeaksRef = React.useRef<number[]>([])
  /** Set when the recorder should throw the clip away rather than hand it over. */
  const abortRef = React.useRef(false)

  const active = state !== "idle"
  React.useEffect(() => onActiveChange?.(active), [active, onActiveChange])

  /** Stop the microphone light. Leaving the track live keeps it on indefinitely. */
  const teardown = React.useCallback(() => {
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop())
    recorderRef.current = null
    analyserRef.current = null
    void audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    for (const ref of [sampleTimerRef, clockTimerRef]) {
      if (ref.current) clearInterval(ref.current)
      ref.current = null
    }
  }, [])

  // Releasing on unmount matters: navigating away mid-recording would otherwise
  // leave the browser's recording indicator on with nothing to turn it off.
  //
  // Set abortRef BEFORE teardown (UI-02): stopping the tracks can fire
  // MediaRecorder.onstop, and without the abort flag that path would UPLOAD the
  // half-finished clip (and setState on an unmounted component). The explicit
  // finish button is the only path that should ever send.
  React.useEffect(() => {
    return () => {
      abortRef.current = true
      teardown()
    }
  }, [teardown])

  /** Reduce the peak history to a fixed number of bars for storage. */
  function compress(peaks: number[], target = STORED_PEAKS): number[] {
    if (peaks.length === 0) return []
    if (peaks.length <= target) return peaks.map((p) => Math.round(p))
    const out: number[] = []
    const per = peaks.length / target
    for (let i = 0; i < target; i++) {
      const slice = peaks.slice(Math.floor(i * per), Math.max(Math.floor((i + 1) * per), 1))
      // Peak, not mean: averaging flattens speech into a featureless ribbon.
      out.push(Math.round(slice.length ? Math.max(...slice) : 0))
    }
    return out
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      allPeaksRef.current = []
      abortRef.current = false

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const chunks = chunksRef.current
        const peaks = compress(allPeaksRef.current)
        const seconds = Math.max(1, Math.round(elapsedRef.current))
        teardown()
        if (abortRef.current || chunks.length === 0) {
          reset()
          return
        }
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" })
        void deliver(blob, seconds, peaks)
      }

      // A tiny FFT is all a 3px bar can express, and it keeps the sampling
      // cheap enough to run alongside the recorder without dropping frames.
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      ctx.createMediaStreamSource(stream).connect(analyser)
      audioCtxRef.current = ctx
      analyserRef.current = analyser

      recorder.start()
      recorderRef.current = recorder
      elapsedRef.current = 0
      setElapsed(0)
      setLive([])
      setState("recording")
      startTimers()
    } catch {
      // Denied or no microphone. Nothing to recover from, so stay put.
      teardown()
      setState("idle")
    }
  }

  const elapsedRef = React.useRef(0)

  function startTimers() {
    sampleTimerRef.current = setInterval(() => {
      const analyser = analyserRef.current
      if (!analyser) return
      const buf = new Uint8Array(analyser.fftSize)
      analyser.getByteTimeDomainData(buf)
      // Silence sits at 128; loudness is how far the wave swings away from it.
      let peak = 0
      for (const v of buf) peak = Math.max(peak, Math.abs(v - 128))
      // Speech rarely exceeds half of full scale, so scale against that instead
      // of 128 - otherwise a normal voice draws a permanently flat line.
      const level = Math.min(100, Math.round((peak / 70) * 100))
      allPeaksRef.current.push(level)
      setLive((prev) => [...prev, level].slice(-LIVE_BARS))
    }, SAMPLE_MS)

    clockTimerRef.current = setInterval(() => {
      elapsedRef.current += 0.2
      setElapsed(elapsedRef.current)
    }, 200)
  }

  function pauseTimers() {
    for (const ref of [sampleTimerRef, clockTimerRef]) {
      if (ref.current) clearInterval(ref.current)
      ref.current = null
    }
  }

  function togglePause() {
    const recorder = recorderRef.current
    if (!recorder) return
    if (state === "recording") {
      recorder.pause()
      pauseTimers()
      setState("paused")
    } else {
      recorder.resume()
      startTimers()
      setState("recording")
    }
  }

  function reset() {
    setState("idle")
    setElapsed(0)
    elapsedRef.current = 0
    setLive([])
    allPeaksRef.current = []
    chunksRef.current = []
  }

  async function deliver(blob: Blob, seconds: number, peaks: number[]) {
    setState("sending")
    try {
      await onSend(blob, seconds, peaks)
      reset()
    } catch {
      // The upload failed and the clip is already gone from the recorder, so
      // there is nothing to retry with. Fail back to idle rather than pretend.
      reset()
    }
  }

  /** Bin: stop the recorder but tell onstop to drop what it collected. */
  function discard() {
    abortRef.current = true
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop()
    } else {
      teardown()
      reset()
    }
  }

  function finish() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      // Flush whatever is buffered, then onstop hands it to deliver().
      recorderRef.current.requestData()
      recorderRef.current.stop()
    }
  }

  if (state === "idle") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Record voice message"
        className="text-muted-foreground hover:text-foreground shrink-0"
        disabled={disabled}
        onClick={start}
      >
        <Mic className="h-4 w-4" />
      </Button>
    )
  }

  const sending = state === "sending"

  return (
    <div className="bg-muted/50 flex min-w-0 flex-1 items-center gap-2 rounded-sm py-1.5 pr-1 pl-2">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Discard recording"
        className="text-muted-foreground hover:text-destructive shrink-0"
        onClick={discard}
        disabled={sending}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      {/* The dot stops blinking when paused, so the state is readable without
          having to find the pause button and work out which way it points. */}
      <span
        className={cn(
          "bg-destructive h-2 w-2 shrink-0 rounded-sm",
          state === "recording" && "animate-pulse",
        )}
      />
      <span className="shrink-0 text-sm tabular-nums" suppressHydrationWarning>
        {clock(elapsed)}
      </span>

      <LiveWaveform peaks={live} paused={state === "paused"} />

      {!sending && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={state === "paused" ? "Resume recording" : "Pause recording"}
          className="text-muted-foreground hover:text-foreground shrink-0"
          onClick={togglePause}
        >
          {state === "paused" ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </Button>
      )}

      <Button
        type="button"
        size="icon"
        aria-label="Send voice message"
        className="h-8 w-8 shrink-0 rounded-sm"
        onClick={finish}
        disabled={sending}
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </div>
  )
}

/**
 * The live trace. Bars are pinned to the right so the newest sample is always
 * under the clock and the history scrolls away leftward - the direction the
 * sound actually travelled.
 */
function LiveWaveform({ peaks, paused }: { peaks: number[]; paused: boolean }) {
  const pad = Math.max(0, LIVE_BARS - peaks.length)

  return (
    <div
      className={cn(
        "flex h-6 min-w-0 flex-1 items-center justify-end gap-px overflow-hidden transition-opacity",
        paused && "opacity-50",
      )}
      aria-hidden
    >
      {/* Leading placeholders keep the trace right-aligned from the first
          sample, instead of it sliding across as the buffer fills. */}
      {Array.from({ length: pad }, (_, i) => (
        <span key={`pad-${i}`} className="bg-muted-foreground/25 h-0.5 w-[3px] rounded-sm" />
      ))}
      {peaks.map((p, i) => (
        <span
          key={i}
          className="bg-foreground/70 w-[3px] rounded-sm"
          style={{ height: `${Math.max(8, p)}%` }}
        />
      ))}
    </div>
  )
}
