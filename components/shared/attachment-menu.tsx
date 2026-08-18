"use client"

/**
 * The "+" menu on a composer: everything you can put in a message that is not
 * typed text.
 *
 * Shared by personal chat and project messages, because the menu is the same
 * menu. The three entries that produce FILES live here in full - a pre-filtered
 * picker, the camera, and stickers - while polls, events and contacts are just
 * callbacks, since their composers are cards rather than uploads.
 *
 * Document / Photos / Audio are separate entries rather than one "Attach"
 * because the `accept` filter is the whole point: picking a spreadsheet out of a
 * folder of four hundred photos is the problem being solved.
 */

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

/** What the picker will accept for each kind, so the file dialog opens narrowed. */
const ACCEPT = {
  document:
    ".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.rtf,.odt,.ods,.zip,.rar,.7z,application/pdf",
  media: "image/*,video/*",
  audio: "audio/*",
  sticker: "image/png,image/webp,image/gif",
} as const

type PickerKind = keyof typeof ACCEPT

export interface AttachmentMenuProps {
  /** Files chosen by any route into this menu. `asSticker` changes how they render. */
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
  const inputRef = React.useRef<HTMLInputElement>(null)
  // Which entry opened the picker, so the change handler knows whether what
  // comes back is a sticker or an ordinary file.
  const pendingRef = React.useRef<PickerKind>("document")
  const [accept, setAccept] = React.useState<string>(ACCEPT.document)
  const [cameraOpen, setCameraOpen] = React.useState(false)

  function pick(kind: PickerKind) {
    pendingRef.current = kind
    setAccept(ACCEPT[kind])
    // The input's `accept` is state, so it has to be committed to the DOM before
    // the dialog opens - otherwise the first pick uses the previous filter.
    requestAnimationFrame(() => inputRef.current?.click())
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
            className="text-muted-foreground hover:text-foreground h-9 w-9 shrink-0"
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
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        aria-hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ""
          if (files.length === 0) return
          void onFiles(files, { asSticker: pendingRef.current === "sticker" })
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

/**
 * Take a photo without leaving the conversation.
 *
 * Built on getUserMedia rather than `<input capture>`: the capture attribute
 * only does anything on a phone, and this has to work at a desk too. The stream
 * is stopped on every exit path - a camera light left on after the dialog closes
 * is alarming in a way a stuck spinner is not.
 */
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

  const stop = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  React.useEffect(() => {
    if (!open) {
      stop()
      return
    }
    let cancelled = false
    setError(null)
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing }, audio: false })
      .then((stream) => {
        // The dialog may have closed while permission was being granted; without
        // this the tracks would stay live with nothing to stop them.
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
  }, [open, facing, stop])

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
    // Re-running the effect is what restarts the stream; flipping and flipping
    // back would be a hack, so nudge `facing` to itself via a fresh object.
    setFacing((f) => f)
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing }, audio: false })
      .then((stream) => {
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => setError("Could not restart the camera."))
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
              <Button variant="ghost" size="sm" onClick={retake}>
                Retake
              </Button>
              <Button
                size="sm"
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
                size="icon-sm"
                aria-label="Switch camera"
                title="Switch camera"
                onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
                disabled={!!error}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={capture} disabled={!!error}>
                <Camera className="mr-2 h-4 w-4" />
                Take photo
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
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
