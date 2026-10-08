"use client"

// The composer "+" menu, shared by chat and project messages. Separate Document / Photos / Audio
// entries so the file dialog opens pre-filtered.

import * as React from "react"
import {
  Plus,
  FileText,
  Images,
  Camera,
  Headphones,
  User,
  BarChart3,
  CalendarDays,
  Sticker,
  X,
  RefreshCw,
  Loader2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const ACCEPT = {
  document:
    ".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.rtf,.odt,.ods,.zip,.rar,.7z,application/pdf",
  media: "image/*,video/*",
  audio: "audio/*",
  sticker: "image/png,image/webp,image/gif",
} as const

type PickerKind = keyof typeof ACCEPT

export interface AttachmentMenuProps {
  /** `asSticker` changes how they render. */
  onFiles: (files: File[], opts?: { asSticker?: boolean }) => void | Promise<void>
  onPoll: () => void
  onEvent: () => void
  onContact: () => void
  disabled?: boolean
  busy?: boolean
}

export function AttachmentMenu({
  onFiles,
  onPoll,
  onEvent,
  onContact,
  disabled,
  busy,
}: AttachmentMenuProps) {
  // State, not refs: the menu items below call pick() and are built during render.
  const [input, setInput] = React.useState<HTMLInputElement | null>(null)
  // Which entry opened the picker: sets `accept` and decides sticker vs ordinary file.
  const [pending, setPending] = React.useState<PickerKind>("document")
  const [cameraOpen, setCameraOpen] = React.useState(false)

  function pick(kind: PickerKind) {
    setPending(kind)
    // Wait a frame so the new `accept` reaches the DOM before the dialog opens.
    requestAnimationFrame(() => input?.click())
  }

  const ITEMS: { icon: React.ElementType; label: string; tone: string; run: () => void }[] = [
    { icon: FileText, label: "Document", tone: "text-indigo-500", run: () => pick("document") },
    { icon: Images, label: "Photos & videos", tone: "text-sky-500", run: () => pick("media") },
    { icon: Camera, label: "Camera", tone: "text-rose-500", run: () => setCameraOpen(true) },
    { icon: Headphones, label: "Audio", tone: "text-orange-500", run: () => pick("audio") },
    { icon: User, label: "Contact", tone: "text-blue-500", run: onContact },
    { icon: BarChart3, label: "Poll", tone: "text-amber-500", run: onPoll },
    { icon: CalendarDays, label: "Event", tone: "text-red-500", run: onEvent },
    { icon: Sticker, label: "New sticker", tone: "text-emerald-500", run: () => pick("sticker") },
  ]

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Attach"
            className="text-muted-foreground hover:text-foreground shrink-0"
            disabled={disabled}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-52">
          {ITEMS.map((item) => (
            <DropdownMenuItem key={item.label} onClick={item.run} className="gap-3 py-2">
              <item.icon className={cn("h-4 w-4", item.tone)} />
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={setInput}
        type="file"
        multiple
        accept={ACCEPT[pending]}
        className="hidden"
        aria-hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ""
          if (files.length === 0) return
          void onFiles(files, { asSticker: pending === "sticker" })
        }}
      />

      <CameraDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={(file) => {
          setCameraOpen(false)
          void onFiles([file])
        }}
      />
    </>
  )
}

/** getUserMedia, not `<input capture>`, so it works on desktops too. The stream is stopped on every exit path. */
function CameraDialog({
  open,
  onOpenChange,
  onCapture,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCapture: (file: File) => void
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const [facing, setFacing] = React.useState<"user" | "environment">("user")
  const [shot, setShot] = React.useState<{ blob: Blob; url: string } | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  // Bumped by Retake to re-run the acquire effect, whose cancelled guard stops stray streams.
  const [restartNonce, setRestartNonce] = React.useState(0)

  const stop = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  // Each acquire below starts with no error showing.
  const acquireKey = `${open}|${facing}|${restartNonce}`
  const [prevAcquireKey, setPrevAcquireKey] = React.useState(acquireKey)
  if (acquireKey !== prevAcquireKey) {
    setPrevAcquireKey(acquireKey)
    if (open) setError(null)
  }

  React.useEffect(() => {
    if (!open) {
      stop()
      return
    }
    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing }, audio: false })
      .then((stream) => {
        // Closed while permission was pending: stop the tracks.
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => {
        if (!cancelled) setError("No camera available, or permission was refused.")
      })
    return () => {
      cancelled = true
      stop()
    }
  }, [open, facing, restartNonce, stop])

  React.useEffect(() => {
    return () => {
      if (shot) URL.revokeObjectURL(shot.url)
    }
  }, [shot])

  function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        setShot({ blob, url: URL.createObjectURL(blob) })
        stop()
      },
      "image/jpeg",
      0.9,
    )
  }

  function retake() {
    if (shot) URL.revokeObjectURL(shot.url)
    setShot(null)
    setRestartNonce((n) => n + 1)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          stop()
          if (shot) URL.revokeObjectURL(shot.url)
          setShot(null)
        }
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-w-lg lg:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">Camera</DialogTitle>
        </DialogHeader>

        {error ? (
          <p className="text-muted-foreground py-8 text-center text-xs">{error}</p>
        ) : (
          <div className="bg-muted overflow-hidden rounded-sm">
            {shot ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shot.url} alt="Captured" className="max-h-80 w-full object-contain" />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="max-h-80 w-full object-contain"
              />
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          {shot ? (
            <>
              <Button variant="ghost" onClick={retake}>
                Retake
              </Button>
              <Button
                onClick={() =>
                  onCapture(
                    new File([shot.blob], `photo-${shot.blob.size}.jpg`, { type: "image/jpeg" }),
                  )
                }
              >
                Send photo
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Switch camera"
                title="Switch camera"
                onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
                disabled={!!error}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button onClick={capture} disabled={!!error}>
                <Camera className="mr-2 h-4 w-4" />
                Take photo
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
