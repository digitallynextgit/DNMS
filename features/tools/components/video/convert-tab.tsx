"use client"

import { useMemo, useState } from "react"
import type {
  AudioCodec,
  ConversionAudioOptions,
  ConversionVideoOptions,
  VideoCodec,
} from "mediabunny"
import { Download, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { FileDrop } from "../file-drop"
import { formatBytes, saveBlob } from "../../lib/files"
import {
  CONTAINER_CODECS,
  MAX_VIDEO_BYTES,
  PREFERRED_CODECS,
  VIDEO_ACCEPT,
  chooseCodec,
  codecLabel,
  convertVideoBitrate,
  convertedName,
  dropMessage,
  sourceVideoBitrate,
  type ConvertTarget,
} from "../../lib/video"
import { ChoiceGroup, TwoColumn, type Choice } from "../pdf/shared"
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

const TARGETS: readonly Choice<ConvertTarget>[] = [
  {
    value: "mp4",
    label: "MP4",
    hint: "Plays everywhere - phones, WhatsApp, Instagram, PowerPoint.",
  },
  {
    value: "webm",
    label: "WebM",
    hint: "For websites. Often smaller, but some iPhones and apps can't play it.",
  },
]

interface Done {
  name: string
  notes: string[]
}

export function ConvertTab() {
  const video = useVideoPick()
  const [target, setTarget] = useState<ConvertTarget>("mp4")
  const [removeAudio, setRemoveAudio] = useState(false)
  const output = useResult<Done>()
  const job = useVideoJob()
  const { file, info } = video
  const { result } = output

  // What happens to the picture and the sound - shown before converting, so a
  // slow re-encode isn't a surprise.
  const plan = useMemo(() => {
    if (!info) return null
    const videoPlan = chooseCodec<string>({
      source: info.videoCodec,
      preferred: PREFERRED_CODECS[target].video,
      container: CONTAINER_CODECS[target].video,
      // Re-making the picture means reading it first.
      encodable: info.canDecodeVideo ? info.encodableVideo : [],
    })
    const audioPlan =
      info.hasAudio && !removeAudio
        ? chooseCodec<string>({
            source: info.audioCodec,
            preferred: PREFERRED_CODECS[target].audio,
            container: CONTAINER_CODECS[target].audio,
            encodable: info.canDecodeAudio ? info.encodableAudio : [],
          })
        : null
    return { video: videoPlan, audio: audioPlan }
  }, [info, target, removeAudio])

  function pick(files: File[]) {
    const next = files[0]
    if (!next) return
    output.clear()
    void video.pick(next)
  }

  async function convert() {
    if (!file || !info || !plan?.video) return
    const videoPlan = plan.video
    const audioPlan = plan.audio
    const to = target
    output.clear()
    const done: { blob?: Blob; extra?: Done } = {}
    const ok = await job.run(async (j) => {
      const mb = await loadMediabunny()
      const keepAudio = info.hasAudio && !removeAudio
      const audio: ConversionAudioOptions =
        keepAudio && audioPlan ? { codec: audioPlan.codec as AudioCodec } : { discard: true }
      // Re-made video gets about the original's quality - not mediabunny's
      // generous default, which can double the size.
      const bitrate = videoPlan.copy
        ? null
        : convertVideoBitrate({
            width: info.width,
            height: info.height,
            fps: info.fps,
            sourceBitrate: sourceVideoBitrate(file.size, info.duration, info.audioBitrate),
            from: info.videoCodec,
            to: videoPlan.codec,
          })
      const video: ConversionVideoOptions = {
        codec: videoPlan.codec as VideoCodec,
        ...(bitrate ? { quality: new mb.Quality({ bitrate }) } : {}),
      }
      const { blob, notes } = await runConversion(j, {
        file,
        output: to,
        label: videoPlan.copy ? "Copying" : "Converting",
        expectedBytes: bitrate ? ((bitrate + 192_000) * info.duration) / 8 : file.size,
        needVideo: true,
        video,
        audio,
      })
      if (keepAudio && !audioPlan) notes.push(dropMessage("audio", "no_encodable_target_codec"))
      done.blob = blob
      done.extra = { name: convertedName(file.name, to), notes }
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

            {info && plan && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-sm border p-3 text-sm">
                <dt className="text-muted-foreground">Picture</dt>
                <dd>
                  {!plan.video ? (
                    <span className="text-destructive">
                      This browser can&apos;t make {target === "mp4" ? "MP4" : "WebM"} video from
                      this file - try {target === "mp4" ? "WebM" : "MP4"}, or Chrome or Edge on a
                      computer.
                    </span>
                  ) : plan.video.copy ? (
                    <>
                      {codecLabel(plan.video.codec)} - copied as it is{" "}
                      <span className="text-muted-foreground">(quick, full quality)</span>
                    </>
                  ) : (
                    <>
                      {codecLabel(info.videoCodec)} to {codecLabel(plan.video.codec)}{" "}
                      <span className="text-muted-foreground">(re-made - takes a while)</span>
                    </>
                  )}
                </dd>
                <dt className="text-muted-foreground">Sound</dt>
                <dd>
                  {!info.hasAudio ? (
                    <span className="text-muted-foreground">None in this video</span>
                  ) : removeAudio ? (
                    "Removed"
                  ) : !plan.audio ? (
                    <span className="text-amber-700 dark:text-amber-300">
                      Left out - this browser can&apos;t convert it
                    </span>
                  ) : plan.audio.copy ? (
                    <>{codecLabel(plan.audio.codec)} - copied as it is</>
                  ) : (
                    <>
                      {codecLabel(info.audioCodec)} to {codecLabel(plan.audio.codec)}
                    </>
                  )}
                </dd>
              </dl>
            )}

            {result && (
              <div className="space-y-3 rounded-sm border p-4" role="status">
                <p className="text-sm">
                  Done: <strong>{result.name}</strong>
                  <span className="text-muted-foreground"> · {formatBytes(result.blob.size)}</span>
                </p>
                <Notes notes={result.notes} />
                <video
                  src={result.url}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label="Converted video"
                  className="max-h-[50vh] w-full rounded-sm bg-black"
                />
                <Button onClick={() => saveBlob(result.blob, result.name)}>
                  <Download />
                  Download video
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      }
      side={
        <>
          <ChoiceGroup
            name="video-convert-to"
            legend="Save as"
            value={target}
            options={TARGETS}
            onChange={(value) => {
              setTarget(value)
              output.clear()
            }}
            disabled={job.busy}
          />
          <div className="flex items-center gap-3">
            <Switch
              id="video-convert-mute"
              checked={removeAudio}
              onCheckedChange={(checked) => {
                setRemoveAudio(checked)
                output.clear()
              }}
              disabled={job.busy}
            />
            <Label htmlFor="video-convert-mute" className="mb-0 font-normal">
              Remove the sound
            </Label>
          </div>
          <Button
            className="w-full"
            disabled={!info || !plan?.video || job.busy}
            loading={job.busy}
            onClick={convert}
          >
            {!job.busy && <RefreshCw />}
            Convert video
          </Button>
          <JobStatus progress={job.progress} onStop={job.stop} />
          <p className="text-muted-foreground text-xs">
            iPhone videos (MOV) are often HEVC, which some computers and apps can&apos;t play - MP4
            turns them into H.264, which plays everywhere.
          </p>
        </>
      }
    />
  )
}
