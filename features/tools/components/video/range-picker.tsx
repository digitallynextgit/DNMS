"use client"

import { useEffect, useRef, useState } from "react"
import { Flag, Pause, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  formatTime,
  moveRangeEnd,
  moveRangeStart,
  parseTime,
  rangeProblem,
  type TimeRange,
} from "../../lib/video"

/** Used by Trim and Video -> GIF. Give it a `key` per file so it starts fresh. */
export function RangePicker({
  id,
  src,
  duration,
  range,
  onChange,
  maxLength,
  active,
  disabled,
}: {
  id: string
  /** Object URL of the video (null: no preview, times can still be typed). */
  src: string | null
  duration: number
  range: TimeRange
  onChange: (range: TimeRange) => void
  /** Longest selection allowed, in seconds. */
  maxLength?: number
  /** False while the tab is hidden - the preview pauses. */
  active: boolean
  disabled?: boolean
}) {
  const video = useRef<HTMLVideoElement>(null)
  /** While "Play selection" runs: where to stop. */
  const stopAt = useRef<number | null>(null)
  const [now, setNow] = useState(0)
  const [playingPart, setPlayingPart] = useState(false)
  const [previewFailed, setPreviewFailed] = useState(false)
  const canPreview = !!src && !previewFailed

  useEffect(() => {
    if (!active) video.current?.pause()
  }, [active])

  function seek(t: number) {
    if (video.current && canPreview) video.current.currentTime = t
    setNow(t)
  }

  function changeStart(t: number) {
    const next = moveRangeStart(range, t, duration, maxLength)
    onChange(next)
    seek(next.start)
  }

  function changeEnd(t: number) {
    const next = moveRangeEnd(range, t, duration, maxLength)
    onChange(next)
    seek(next.end)
  }

  function here(): number {
    return video.current?.currentTime ?? now
  }

  function togglePart() {
    const v = video.current
    if (!v) return
    if (playingPart) {
      v.pause()
      return
    }
    stopAt.current = range.end
    v.currentTime = range.start
    setPlayingPart(true)
    v.play().catch(() => {
      stopAt.current = null
      setPlayingPart(false)
    })
  }

  const problem = rangeProblem(range, duration, maxLength)
  const pct = (t: number) =>
    `${duration > 0 ? Math.min(100, Math.max(0, (t / duration) * 100)) : 0}%`

  return (
    <div className="space-y-4">
      {canPreview ? (
        <video
          ref={video}
          src={src}
          controls
          playsInline
          preload="metadata"
          aria-label="Video preview"
          className="max-h-[55vh] w-full rounded-sm bg-black"
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime
            setNow(t)
            if (stopAt.current !== null && t >= stopAt.current) e.currentTarget.pause()
          }}
          onSeeked={(e) => setNow(e.currentTarget.currentTime)}
          onPause={() => {
            stopAt.current = null
            setPlayingPart(false)
          }}
          onError={() => setPreviewFailed(true)}
        />
      ) : (
        <div className="bg-muted text-muted-foreground rounded-sm p-4 text-sm">
          This browser can&apos;t show a preview of this video, but you can still type the start and
          end times below.
        </div>
      )}

      <div
        aria-hidden="true"
        className="bg-muted relative h-3 cursor-pointer rounded-sm"
        onClick={(e) => {
          if (!canPreview) return
          const box = e.currentTarget.getBoundingClientRect()
          seek(((e.clientX - box.left) / box.width) * duration)
        }}
      >
        <div
          className="bg-primary/50 absolute inset-y-0 rounded-sm"
          style={{ left: pct(range.start), width: pct(range.end - range.start) }}
        />
        {canPreview && (
          <div className="bg-foreground absolute -inset-y-1 w-0.5" style={{ left: pct(now) }} />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <EndPoint
          id={`${id}-start`}
          label="Start"
          value={range.start}
          duration={duration}
          onChange={changeStart}
          onHere={canPreview ? () => changeStart(here()) : undefined}
          disabled={disabled}
        />
        <EndPoint
          id={`${id}-end`}
          label="End"
          value={range.end}
          duration={duration}
          onChange={changeEnd}
          onHere={canPreview ? () => changeEnd(here()) : undefined}
          disabled={disabled}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          Selected: <strong className="tabular-nums">{formatTime(range.end - range.start)}</strong>
          <span className="text-muted-foreground tabular-nums">
            {" "}
            ({formatTime(range.start)} to {formatTime(range.end)})
          </span>
        </p>
        {canPreview && (
          <Button variant="outline" onClick={togglePart} disabled={disabled || !!problem}>
            {playingPart ? <Pause /> : <Play />}
            {playingPart ? "Stop preview" : "Play selection"}
          </Button>
        )}
      </div>
      {problem && (
        <p className="text-destructive text-sm" role="alert">
          {problem}
        </p>
      )}
    </div>
  )
}

function EndPoint({
  id,
  label,
  value,
  duration,
  onChange,
  onHere,
  disabled,
}: {
  id: string
  label: "Start" | "End"
  value: number
  duration: number
  onChange: (t: number) => void
  /** Set this end to where the player is (absent without a preview). */
  onHere?: () => void
  disabled?: boolean
}) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="sr-only">{label}</legend>
      <div className="flex items-end gap-2">
        <TimeField
          id={id}
          label={`${label} (m:ss)`}
          value={value}
          duration={duration}
          onCommit={onChange}
        />
        {onHere && (
          <Button variant="outline" onClick={onHere} className="shrink-0">
            <Flag />
            Set {label.toLowerCase()} here
          </Button>
        )}
      </div>
      <input
        type="range"
        min={0}
        max={duration}
        step={0.1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${label} slider`}
        aria-valuetext={formatTime(value)}
        className="accent-primary w-full"
      />
    </fieldset>
  )
}

/** Keeps the person's text while editing; checked on Enter or blur, and Escape restores the old value. */
function TimeField({
  id,
  label,
  value,
  duration,
  onCommit,
}: {
  id: string
  label: string
  value: number
  duration: number
  onCommit: (t: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function commit() {
    if (draft === null) return
    const t = parseTime(draft)
    if (t === null) {
      setError("Type a time like 0:12 or 1:05.5")
      return
    }
    if (t > duration + 0.05) {
      setError(`The video is only ${formatTime(duration)} long`)
      return
    }
    setError(null)
    setDraft(null)
    onCommit(t)
  }

  return (
    <div className="min-w-0 flex-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={draft ?? formatTime(value)}
        onChange={(e) => {
          setDraft(e.target.value)
          setError(null)
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commit()
          } else if (e.key === "Escape") {
            setDraft(null)
            setError(null)
          }
        }}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className="tabular-nums"
      />
      {error && (
        <p id={`${id}-error`} className="text-destructive mt-1 text-xs">
          {error}
        </p>
      )}
    </div>
  )
}
