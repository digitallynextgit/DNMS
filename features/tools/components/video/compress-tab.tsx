"use client"

import { useMemo, useState } from "react"
import type { ConversionAudioOptions } from "mediabunny"
import { ArrowRight, Download, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { FileDrop } from "../file-drop"
import { formatBytes, saveBlob, savedPercent } from "../../lib/files"
import {
  ENCODE_HELP,
  MAX_VIDEO_BYTES,
  VIDEO_ACCEPT,
  compressedName,
  formatBitrate,
  planCompression,
  type CompressPreset,
  type MaxResolution,
} from "../../lib/video"
import { ChoiceGroup, FriendlyError, TwoColumn, type Choice } from "../pdf/shared"
import {
  FileWarnings,
  JobStatus,
  Notes,
  VIDEO_DROP_HINT,
  VideoFileCard,
  loadMediabunny,
  runConversion,
  useResult,
  useVideoJob,
  useVideoPick,
} from "./shared"

const PRESETS: readonly Choice<CompressPreset>[] = [
  {
    value: "small",
    label: "Small file",
    hint: "For WhatsApp and email. A little softer, fine on a phone.",
  },
  { value: "balanced", label: "Balanced", hint: "Good for Instagram, YouTube and websites." },
  { value: "high", label: "High quality", hint: "Closest to the original - saves less space." },
]

const MAX_SIZES: readonly { value: MaxResolution; label: string }[] = [
  { value: "original", label: "Same as the original" },
  { value: "1080", label: "1080p (Full HD)" },
  { value: "720", label: "720p (HD)" },
  { value: "480", label: "480p (small)" },
]

interface Done {
  name: string
  before: number
  after: number
  notes: string[]
}

export function CompressTab() {
  const video = useVideoPick()
  const [preset, setPreset] = useState<CompressPreset>("balanced")
  const [maxRes, setMaxRes] = useState<MaxResolution>("original")
  const output = useResult<Done>()
  const job = useVideoJob()
  const { file, info } = video
  const { result } = output

  const plan = useMemo(
    () =>
      file && info
        ? planCompression({
            fileBytes: file.size,
            duration: info.duration,
            width: info.width,
            height: info.height,
            fps: info.fps,
            hasAudio: info.hasAudio,
            audioCodec: info.audioCodec,
            audioBitrate: info.audioBitrate,
            canEncodeAac: info.encodableAudio.includes("aac"),
            preset,
            maxResolution: maxRes,
          })
        : null,
    [file, info, preset, maxRes],
  )
  const unreadable = !!info && !info.canDecodeVideo

  function pick(files: File[]) {
    const next = files[0]
    if (!next) return
    output.clear()
    void video.pick(next)
  }

  async function compress() {
    if (!file || !info || !plan) return
    output.clear()
    const done: { blob?: Blob; extra?: Done } = {}
    const ok = await job.run(async (j) => {
      const mb = await loadMediabunny()
      const quality = new mb.Quality({ bitrate: plan.videoBitrate })
      // H.264 first: it plays everywhere. Then whatever else this browser can make.
      const codec = await mb.getFirstEncodableVideoCodec(["avc", "hevc", "vp9", "av1"], {
        width: plan.width,
        height: plan.height,
        quality,
      })
      if (!codec)
        throw new FriendlyError(
          ENCODE_HELP,
          maxRes === "original" || maxRes === "1080"
            ? "A smaller size, like 720p, may work."
            : undefined,
        )
      const audio: ConversionAudioOptions | undefined =
        plan.audio?.action === "copy"
          ? { codec: "aac" }
          : plan.audio?.action === "encode"
            ? { codec: "aac", quality: new mb.Quality({ bitrate: plan.audio.bitrate }) }
            : undefined
      const { blob, notes } = await runConversion(j, {
        file,
        output: "mp4",
        label: "Compressing",
        expectedBytes: plan.estimatedBytes,
        needVideo: true,
        video: {
          codec,
          quality,
          forceTranscode: true,
          ...(plan.resize ? { width: plan.width, height: plan.height, fit: "fill" as const } : {}),
        },
        audio,
      })
      done.blob = blob
      done.extra = { name: compressedName(file.name), before: file.size, after: blob.size, notes }
    })
    if (ok && done.blob && done.extra) output.show(done.blob, done.extra)
  }

  const smaller = !!result && result.after < result.before

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
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{formatBytes(result.before)}</span>
                  <ArrowRight aria-label="to" className="text-muted-foreground h-4 w-4" />
                  <span className="font-semibold">{formatBytes(result.after)}</span>
                  {smaller && (
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      {savedPercent(result.before, result.after)}% smaller
                    </span>
                  )}
                </div>
                <Notes notes={result.notes} />
                {smaller ? (
                  <>
                    <video
                      src={result.url}
                      controls
                      playsInline
                      preload="metadata"
                      aria-label="Compressed video"
                      className="max-h-[50vh] w-full rounded-sm bg-black"
                    />
                    <Button onClick={() => saveBlob(result.blob, result.name)}>
                      <Download />
                      Download compressed video
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    That came out no smaller than your original, so keep the original - it&apos;s
                    already well compressed.
                    {preset !== "small" && ' You could try "Small file"'}
                    {preset !== "small" && maxRes === "original" && " or a smaller size"}
                    {preset !== "small" && "."}
                    {preset === "small" &&
                      maxRes !== "480" &&
                      " You could try a smaller size, like 720p."}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      }
      side={
        <>
          <ChoiceGroup
            name="video-compress-level"
            legend="Quality"
            value={preset}
            options={PRESETS}
            onChange={(value) => {
              setPreset(value)
              output.clear()
            }}
            disabled={job.busy}
          />
          <div>
            <Label htmlFor="video-compress-size">Size</Label>
            <Select
              value={maxRes}
              onValueChange={(value) => {
                setMaxRes(value as MaxResolution)
                output.clear()
              }}
              disabled={job.busy}
            >
              <SelectTrigger id="video-compress-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAX_SIZES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground mt-1.5 text-xs">
              Smaller sizes save the most. 1080p means 1920 x 1080, or 1080 x 1920 for a reel.
            </p>
          </div>
          {file && info && plan && (
            <div className="bg-muted/50 space-y-1 rounded-sm p-3 text-xs">
              <p>
                <span className="text-muted-foreground">Comes out at </span>
                <strong>
                  {plan.width} x {plan.height}
                </strong>
                <span className="text-muted-foreground">
                  , video {formatBitrate(plan.videoBitrate)}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">About </span>
                <strong>{formatBytes(plan.estimatedBytes)}</strong>
                <span className="text-muted-foreground"> (now {formatBytes(file.size)})</span>
              </p>
              {plan.estimatedBytes > file.size * 0.9 && (
                <p className="text-amber-700 dark:text-amber-300">
                  This video is already well compressed - try Small file or a smaller size.
                </p>
              )}
            </div>
          )}
          <Button
            className="w-full"
            disabled={!info || unreadable || job.busy}
            loading={job.busy}
            onClick={compress}
          >
            {!job.busy && <Minimize2 />}
            Compress video
          </Button>
          <JobStatus progress={job.progress} onStop={job.stop} />
          <p className="text-muted-foreground text-xs">
            Saves an MP4 (H.264) that plays everywhere. Long videos take a while - keep this tab
            open until it&apos;s done.
          </p>
        </>
      }
    />
  )
}
