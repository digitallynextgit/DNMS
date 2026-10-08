"use client"

import { useState } from "react"
import { AudioLines, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FileDrop } from "../file-drop"
import { formatBytes, saveBlob } from "../../lib/files"
import {
  MAX_VIDEO_BYTES,
  VIDEO_ACCEPT,
  audioName,
  codecLabel,
  formatDuration,
  wavBytes,
} from "../../lib/video"
import { ChoiceGroup, TwoColumn, type Choice } from "../pdf/shared"
import {
  JobStatus,
  Notice,
  VIDEO_DROP_HINT,
  VideoFileCard,
  FileWarnings,
  loadMediabunny,
  runConversion,
  useResult,
  useVideoJob,
  useVideoPick,
  type VideoInfo,
} from "./shared"

type AudioFormat = "m4a" | "wav"

const FORMATS: readonly Choice<AudioFormat>[] = [
  {
    value: "m4a",
    label: "M4A (AAC)",
    hint: "Small, plays everywhere. For sharing, voice-overs and reference.",
  },
  {
    value: "wav",
    label: "WAV",
    hint: "Full quality for editing (Premiere, Audition, CapCut). About 10 MB a minute.",
  },
]

/** M4A from AAC sound is copied as it is; anything else is re-made as AAC at this bitrate. */
const M4A_BITRATE = 192_000

function blocker(format: AudioFormat, info: VideoInfo): string | null {
  if (format === "m4a") {
    if (info.audioCodec === "aac") return null
    if (info.canDecodeAudio && info.encodableAudio.includes("aac")) return null
    return `This browser can't turn this video's sound (${codecLabel(info.audioCodec)}) into M4A - pick WAV, or use Chrome or Edge on a computer.`
  }
  if (info.canDecodeAudio) return null
  return `This browser can't read this video's sound (${codecLabel(info.audioCodec)}) - try Chrome or Edge on a computer.`
}

interface Done {
  name: string
  format: AudioFormat
}

export function AudioTab() {
  const video = useVideoPick({ need: "audio" })
  const [format, setFormat] = useState<AudioFormat>("m4a")
  const output = useResult<Done>()
  const job = useVideoJob()
  const { file, info } = video
  const { result } = output
  const problem = info ? blocker(format, info) : null

  function pick(files: File[]) {
    const next = files[0]
    if (!next) return
    output.clear()
    void video.pick(next)
  }

  async function extract() {
    if (!file || !info || problem) return
    const as = format
    output.clear()
    const done: { blob?: Blob; extra?: Done } = {}
    const ok = await job.run(async (j) => {
      const mb = await loadMediabunny()
      const { blob } = await runConversion(j, {
        file,
        output: as,
        label: "Saving the sound",
        expectedBytes:
          as === "wav"
            ? wavBytes(info.duration, info.sampleRate || 48000, info.channels || 2)
            : (info.duration * M4A_BITRATE) / 8,
        needAudio: true,
        video: { discard: true },
        audio:
          as === "wav"
            ? { codec: "pcm-s16" }
            : info.audioCodec === "aac"
              ? { codec: "aac" }
              : { codec: "aac", quality: new mb.Quality({ bitrate: M4A_BITRATE }) },
      })
      done.blob = blob
      done.extra = { name: audioName(file.name, as), format: as }
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
                  <p className="text-muted-foreground text-sm">
                    Sound: {codecLabel(info.audioCodec)}
                    {info.channels > 0 &&
                      `, ${info.channels === 1 ? "mono" : info.channels === 2 ? "stereo" : `${info.channels} channels`}`}
                    {info.sampleRate > 0 && `, ${(info.sampleRate / 1000).toFixed(1)} kHz`}
                    {` · ${formatDuration(info.duration)}`}
                  </p>
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
                  Done: <strong>{result.name}</strong>
                  <span className="text-muted-foreground"> · {formatBytes(result.blob.size)}</span>
                </p>
                <audio
                  src={result.url}
                  controls
                  preload="metadata"
                  aria-label="The extracted sound"
                  className="w-full"
                />
                <Button onClick={() => saveBlob(result.blob, result.name)}>
                  <Download />
                  Download {result.format === "wav" ? "WAV" : "M4A"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      }
      side={
        <>
          <ChoiceGroup
            name="video-audio-format"
            legend="Save as"
            value={format}
            options={FORMATS}
            onChange={(value) => {
              setFormat(value)
              output.clear()
            }}
            disabled={job.busy}
          />
          {problem && <Notice role="alert">{problem}</Notice>}
          {info && !problem && format === "wav" && (
            <p className="text-muted-foreground text-xs">
              About {formatBytes(wavBytes(info.duration, info.sampleRate, info.channels))}.
            </p>
          )}
          <Button
            className="w-full"
            disabled={!info || !!problem || job.busy}
            loading={job.busy}
            onClick={extract}
          >
            {!job.busy && <AudioLines />}
            Extract audio
          </Button>
          <JobStatus progress={job.progress} onStop={job.stop} />
          <p className="text-muted-foreground text-xs">
            No MP3 here: browsers can&apos;t make MP3s on their own. M4A plays everywhere MP3 does,
            including WhatsApp and iPhones.
          </p>
        </>
      }
    />
  )
}
