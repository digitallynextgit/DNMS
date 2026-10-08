"use client"

import { useState } from "react"
import Image from "next/image"
import { ImageOff, Maximize2 } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { HELP_SHOTS } from "../shots.generated"
import type { HelpLang, HelpShot, HelpShotFile } from "../types"

/** Boxes are stored as fractions of the image, so they stay on target at any width. */
export function HelpShotFigure({
  shot,
  alt,
  lang,
}: {
  shot: HelpShot
  alt: string
  lang: HelpLang
}) {
  const [open, setOpen] = useState(false)
  const file = HELP_SHOTS[shot.id]

  if (!file) {
    return (
      <div className="text-muted-foreground flex aspect-[16/7] w-full flex-col items-center justify-center gap-2 rounded-sm border border-dashed text-xs">
        <ImageOff className="h-5 w-5" />
        {lang === "hi" ? "स्क्रीनशॉट जल्द आ रहा है" : "Screenshot coming soon"}
      </div>
    )
  }

  return (
    <figure>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group bg-muted/30 relative block w-full overflow-hidden rounded-sm border text-left"
        aria-label={lang === "hi" ? "बड़ा करके देखें" : "View larger"}
      >
        <Picture file={file} alt={alt} />
        <span className="bg-background/90 text-foreground absolute right-2 bottom-2 flex items-center gap-1 rounded-sm border px-2 py-1 text-[11px] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Maximize2 className="h-3 w-3" />
          {lang === "hi" ? "बड़ा करें" : "Enlarge"}
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100%-1rem)] max-w-none lg:max-w-[min(92vw,1600px)]">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <div className="overflow-hidden rounded-sm border">
            <Picture file={file} alt={alt} large />
          </div>
        </DialogContent>
      </Dialog>
    </figure>
  )
}

function Picture({ file, alt, large }: { file: HelpShotFile; alt: string; large?: boolean }) {
  return (
    <div className="relative">
      <Image
        src={file.src}
        width={file.width}
        height={file.height}
        alt={alt}
        className="block h-auto w-full"
        sizes={large ? "92vw" : "(min-width: 1024px) 760px, 100vw"}
      />
      {file.boxes.map((b, i) =>
        b === null ? null : (
          <span
            key={i}
            aria-hidden
            className="pointer-events-none absolute rounded-sm ring-2 ring-amber-400 ring-offset-0"
            style={{
              left: `${b.x * 100}%`,
              top: `${b.y * 100}%`,
              width: `${b.w * 100}%`,
              height: `${b.h * 100}%`,
              boxShadow: "0 0 0 4px rgb(251 191 36 / 0.25)",
            }}
          >
            <span
              className={cn(
                "absolute flex items-center justify-center rounded-full bg-amber-400 font-semibold text-black shadow",
                large ? "-top-3 -left-3 h-6 w-6 text-xs" : "-top-2.5 -left-2.5 h-5 w-5 text-[11px]",
              )}
            >
              {i + 1}
            </span>
          </span>
        ),
      )}
    </div>
  )
}
