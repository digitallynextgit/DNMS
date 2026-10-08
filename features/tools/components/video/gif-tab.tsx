"use client"

import { useState } from "react"
import { Download, ImagePlay } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FileDrop } from "../file-drop"
import { formatBytes, saveBlob } from "../../lib/files"
import {
  FORMAT_HELP,
  GIF_FPS,
  GIF_WIDTHS,
  MAX_GIF_SECONDS,
  MAX_VIDEO_BYTES,
  VIDEO_ACCEPT,
  estimateGifBytes,
  gifDelays,
  gifFrameTimes,
  gifName,
  gifSize,
  initialRange,
  rangeProblem,
  tidyRange,
  type GifFps,
  type GifWidth,
  type TimeRange,
} from "../../lib/video"
import { ChoiceGroup, FriendlyError, TwoColumn, type Choice } from "../pdf/shared"
import { RangePicker } from "./range-picker"
import {
  FileWarnings,
  JobStatus,
  Notice,
  VIDEO_DROP_HINT,
  VideoFileCard,
  loadGifenc,
  loadMediabunny,
  useResult,
  useVideoJob,
  useVideoPick,
} from "./shared"

const WIDTH_HINTS: Record<GifWidth, string> = {
  320: "Small - for chat and email",
  480: "Medium - good for most uses",
  640: "Large - sharper, much bigger file",
}
const WIDTHS: readonly Choice<`${GifWidth}`>[] = GIF_WIDTHS.map((w) => ({
  value: `${w}`,
  label: `${w} px wide`,
  hint: WIDTH_HINTS[w],
}))

const FPS_HINTS: Record<GifFps, string> = {
  8: "Smallest file, a little jumpy",
  10: "Smooth enough for most clips",
  15: "Smoothest, biggest file",
}
const FPS: readonly Choice<`${GifFps}`>[] = GIF_FPS.map((f) => ({
  value: `${f}`,
  label: `${f} frames a second`,
  hint: FPS_HINTS[f],
}))

/** GIFs over this get a "that's big" note. */
const BIG_GIF_BYTES = 8 * 1024 * 1024

interface Done {
  name: string
  width: number
  height: number
  frames: number
}

/** One canvas for reading pixels back (willReadFrequently keeps it in memory, not on the GPU). */
function pixelReader(width: number, height: number) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("Canvas 2D isn't available")
  return {
    read(frame: CanvasImageSource): Uint8ClampedArray {
      ctx.drawImage(frame, 0, 0, width, height)
      return ctx.getImageData(0, 0, width, height).data
    },
    release() {
      canvas.width = 0
      canvas.height = 0
    },
  }
}

export function GifTab({ active }: { active: boolean }) {
  const video = useVideoPick({ preview: true })
  const [range, setRange] = useState<TimeRange>({ start: 0, end: 0 })
  const [width, setWidth] = useState<GifWidth>(480)
  const [fps, setFps] = useState<GifFps>(10)
  const output = useResult<Done>()
  const job = useVideoJob()
  const { file, info } = video
  const { result } = output

  const problem = info ? rangeProblem(range, info.duration, MAX_GIF_SECONDS) : null
  const unreadable = !!info && !info.canDecodeVideo
  const size = info ? gifSize(width, info.width, info.height) : null
  const frames = info ? gifFrameTimes(tidyRange(range), fps).length : 0
  const estimate = size ? estimateGifBytes(size.width, size.height, frames) : 0

  async function pick(files: File[]) {
    const next = files[0]
    if (!next) return
    output.clear()
    const found = await video.pick(next)
    if (found) setRange(initialRange(found.duration, Math.min(5, MAX_GIF_SECONDS)))
  }

  function changeRange(next: TimeRange) {
    setRange(next)
    output.clear()
  }

  async function makeGif() {
    if (!file || !info || !size || problem) return
    const cut = tidyRange(range)
    const rate = fps
    const { width: w, height: h } = size
    output.clear()
    const done: { blob?: Blob; extra?: Done } = {}
    const ok = await job.run(async (j) => {
      const [mb, gifenc] = await Promise.all([loadMediabunny(), loadGifenc()])
      const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS })
      const reader = pixelReader(w, h)
      try {
        const track = await input.getPrimaryVideoTrack()
        if (!track || !(await track.canDecode())) throw new FriendlyError(FORMAT_HELP)
        const times = gifFrameTimes(cut, rate)
        const delays = gifDelays(times.length, rate)
        // Frames come out already scaled to the GIF size (and turned the right way up).
        const sink = new mb.CanvasSink(track, { width: w, height: h, fit: "fill", poolSize: 1 })
        const gif = gifenc.GIFEncoder()
        let last: { index: Uint8Array; palette: number[][] } | null = null
        let n = 0
        for await (const frame of sink.canvasesAtTimestamps(times)) {
          const delay = delays[n] ?? 100
          if (frame) {
            const pixels = reader.read(frame.canvas)
            // A palette per frame: video colours shift too much for one to fit all.
            const palette = gifenc.quantize(pixels, 256)
            last = { index: gifenc.applyPalette(pixels, palette), palette }
          }
          // A frame the decoder skipped repeats the one before it, so the timing holds.
          if (last) gif.writeFrame(last.index, w, h, { palette: last.palette, delay })
          n++
          j.report(n / times.length, `Frame ${n} of ${times.length}`)
          await j.checkpoint()
        }
        if (!last) throw new FriendlyError(FORMAT_HELP)
        j.report(1, "Saving...")
        gif.finish()
        done.blob = new Blob([gif.bytesView() as BlobPart], { type: "image/gif" })
        done.extra = { name: gifName(file.name), width: w, height: h, frames: times.length }
      } finally {
        reader.release()
        input.dispose()
      }
    })
    if (ok && done.blob && done.extra) output.show(done.blob, done.extra)
  }

  return (
    <TwoColumn
      main={
        <Card>
          <CardContent className="space-y-4 p-3 sm:p-5">
            {file ? (
              <>
                <VideoFileCard
                  file={file}
                  info={info}
                  onRemove={() => {
                    output.clear()
                    video.clear()
                  }}
                  disabled={job.busy}
                />
                <FileWarnings
                  bigOnPhone={video.bigOnPhone}
                  size={file.size}
                  unreadable={unreadable}
                />
                {info && (
                  <RangePicker
                    key={video.url ?? file.name}
                    id="video-gif"
                    src={video.url}
                    duration={info.duration}
                    range={range}
                    onChange={changeRange}
                    maxLength={MAX_GIF_SECONDS}
                    active={active}
                    disabled={job.busy}
                  />
                )}
              </>
            ) : (
              <FileDrop
                accept={VIDEO_ACCEPT}
                maxBytes={MAX_VIDEO_BYTES}
                label="Drop a video here or click to choose"
                hint={VIDEO_DROP_HINT}
                onFiles={pick}
              />
            )}

            {result && (
              <div className="space-y-3 rounded-sm border p-4" role="status">
                <p className="text-sm">
                  Your GIF:{" "}
                  <strong>
                    {result.width} x {result.height}
                  </strong>
                  <span className="text-muted-foreground">
                    {" "}
                    · {result.frames} frames · {formatBytes(result.blob.size)}
                  </span>
                </p>
                {result.blob.size > BIG_GIF_BYTES && (
                  <Notice>
                    That&apos;s a big GIF - some apps won&apos;t take it. Try a shorter part, a
                    smaller width or fewer frames a second.
                  </Notice>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, not a served image */}
                <img
                  src={result.url}
                  alt="Your GIF"
                  width={result.width}
                  height={result.height}
                  className="bg-muted h-auto max-h-[50vh] w-auto max-w-full rounded-sm"
                />
                <Button onClick={() => saveBlob(result.blob, result.name)}>
                  <Download />
                  Download GIF
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      }
      side={
        <>
          <ChoiceGroup
            name="video-gif-width"
            legend="Width"
            value={`${width}`}
            options={WIDTHS}
            onChange={(value) => {
              setWidth(Number(value) as GifWidth)
              output.clear()
            }}
            disabled={job.busy}
          />
          <ChoiceGroup
            name="video-gif-fps"
            legend="Smoothness"
            value={`${fps}`}
            options={FPS}
            onChange={(value) => {
              setFps(Number(value) as GifFps)
              output.clear()
            }}
            disabled={job.busy}
          />
          {info && size && !problem && (
            <p className="bg-muted/50 rounded-sm p-3 text-xs">
              <span className="text-muted-foreground">About </span>
              <strong>{formatBytes(estimate)}</strong>
              <span className="text-muted-foreground">
                {" "}
                · {size.width} x {size.height} · {frames} frames (a rough guess)
              </span>
            </p>
          )}
          <Button
            className="w-full"
            disabled={!info || !!problem || unreadable || job.busy}
            loading={job.busy}
            onClick={makeGif}
          >
            {!job.busy && <ImagePlay />}
            Make GIF
          </Button>
          <JobStatus progress={job.progress} onStop={job.stop} />
          <p className="text-muted-foreground text-xs">
            GIFs get big fast - keep them short (up to {MAX_GIF_SECONDS} seconds). For WhatsApp or
            Instagram, a short MP4 from Trim is smaller and sharper.
          </p>
        </>
      }
    />
  )
}
