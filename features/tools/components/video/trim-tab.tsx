"use client"

import { useState } from "react"
import type { ConversionVideoOptions } from "mediabunny"
import { Download, Scissors } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FileDrop } from "../file-drop"
import { formatBytes, saveBlob } from "../../lib/files"
import {
  MAX_VIDEO_BYTES,
  VIDEO_ACCEPT,
  convertVideoBitrate,
  formatTime,
  initialRange,
  rangeProblem,
  sourceVideoBitrate,
  tidyRange,
  trimContainer,
  trimmedName,
  type TimeRange,
} from "../../lib/video"
import { TwoColumn } from "../pdf/shared"
import { RangePicker } from "./range-picker"
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
  type VideoInfo,
} from "./shared"

const SAVES_AS = { mp4: "an MP4", mov: "a MOV", webm: "a WebM", mkv: "an MKV" } as const

interface Done {
  name: string
  length: number
  notes: string[]
}

/** WebM can't start between key frames, so a clip not starting at 0 is re-encoded (MP4/MOV are copied). */
async function webmTrimVideo(
  file: File,
  info: VideoInfo,
  cut: TimeRange,
): Promise<ConversionVideoOptions | undefined> {
  if (trimContainer(info.mimeType, file.name) !== "webm" || cut.start === 0) return undefined
  const mb = await loadMediabunny()
  const codec = info.videoCodec
  const bitrate = convertVideoBitrate({
    width: info.width,
    height: info.height,
    fps: info.fps,
    sourceBitrate: sourceVideoBitrate(file.size, info.duration, info.audioBitrate),
    from: codec,
    to: codec ?? "vp9",
  })
  return {
    ...(codec && info.encodableVideo.includes(codec) ? { codec } : {}),
    quality: new mb.Quality({ bitrate }),
  }
}

export function TrimTab({ active }: { active: boolean }) {
  const video = useVideoPick({ preview: true })
  const [range, setRange] = useState<TimeRange>({ start: 0, end: 0 })
  const output = useResult<Done>()
  const job = useVideoJob()
  const { file, info } = video
  const { result } = output
  const container = info && file ? trimContainer(info.mimeType, file.name) : "mp4"
  const problem = info ? rangeProblem(range, info.duration) : null

  async function pick(files: File[]) {
    const next = files[0]
    if (!next) return
    output.clear()
    const found = await video.pick(next)
    if (found) setRange(initialRange(found.duration))
  }

  function changeRange(next: TimeRange) {
    setRange(next)
    output.clear()
  }

  async function trim() {
    if (!file || !info || problem) return
    const cut = tidyRange(range)
    output.clear()
    const done: { blob?: Blob; extra?: Done } = {}
    const ok = await job.run(async (j) => {
      const share = (cut.end - cut.start) / info.duration
      const { blob, notes } = await runConversion(j, {
        file,
        output: container,
        label: "Cutting",
        expectedBytes: file.size * share * 1.1,
        trim: cut,
        needVideo: true,
        video: await webmTrimVideo(file, info, cut),
      })
      done.blob = blob
      done.extra = {
        name: trimmedName(file.name, cut, container),
        length: cut.end - cut.start,
        notes,
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
                <FileWarnings bigOnPhone={video.bigOnPhone} size={file.size} />
                {info && (
                  <RangePicker
                    key={video.url ?? file.name}
                    id="video-trim"
                    src={video.url}
                    duration={info.duration}
                    range={range}
                    onChange={changeRange}
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
                  Your clip: <strong>{formatTime(result.length)}</strong>
                  <span className="text-muted-foreground"> · {formatBytes(result.blob.size)}</span>
                </p>
                <Notes notes={result.notes} />
                <video
                  src={result.url}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label="Trimmed clip"
                  className="max-h-[50vh] w-full rounded-sm bg-black"
                />
                <Button onClick={() => saveBlob(result.blob, result.name)}>
                  <Download />
                  Download clip
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      }
      side={
        <>
          <div className="space-y-2 text-sm">
            <p className="font-medium">How to trim</p>
            <ol className="text-muted-foreground list-decimal space-y-1 pl-4 text-xs">
              <li>Play the video and press Set start here where the clip should begin.</li>
              <li>Press Set end here where it should stop - or type the times, like 0:12.</li>
              <li>Press Play selection to check it, then Trim video.</li>
            </ol>
          </div>
          <Button
            className="w-full"
            disabled={!info || !!problem || job.busy}
            loading={job.busy}
            onClick={trim}
          >
            {!job.busy && <Scissors />}
            Trim video
          </Button>
          <JobStatus progress={job.progress} onStop={job.stop} />
          {info && (
            <p className="text-muted-foreground text-xs">
              Saves {SAVES_AS[container]} file.{" "}
              {container === "webm"
                ? "WebM clips usually have to be re-made, which can take a while."
                : "Quick, and with no loss of quality."}
            </p>
          )}
        </>
      }
    />
  )
}
