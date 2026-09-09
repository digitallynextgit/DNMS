"use client"

import { Download, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

export interface PreviewItem {
  name: string
  kind: "pdf" | "image"
  /** Inline-renderable URL (a signed B2 URL, or an image link). */
  url: string
  /** URL that forces a download; falls back to `url`. */
  downloadUrl?: string
  subtitle?: string
}

/**
 * In-page viewer for PDFs and images, so "have a look" does not mean leaving
 * the project. Everything else (docs, sheets, archives) still opens in a new
 * tab because the browser cannot render it inline anyway.
 */
export function FilePreviewSheet({
  item,
  onClose,
}: {
  item: PreviewItem | null
  onClose: () => void
}) {
  return (
    <Sheet open={item !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-4xl">
        <SheetHeader className="border-b px-5 py-4 pr-12">
          <SheetTitle className="truncate text-base" title={item?.name}>
            {item?.name ?? ""}
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <span className="truncate">
              {item?.subtitle ?? (item?.kind === "pdf" ? "PDF" : "Image")}
            </span>
            {item && (
              <span className="ml-auto flex shrink-0 items-center gap-1">
                <Button variant="outline" asChild>
                  <a href={item.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a href={item.downloadUrl ?? item.url} download={item.name}>
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Download
                  </a>
                </Button>
              </span>
            )}
          </SheetDescription>
        </SheetHeader>
        <div className="bg-muted/30 min-h-0 flex-1">
          {item?.kind === "pdf" && (
            <iframe title={item.name} src={item.url} className="h-full w-full border-0" />
          )}
          {item?.kind === "image" && (
            <div className="flex h-full w-full items-center justify-center overflow-auto p-4">
              {/* Signed storage URLs change per request, so next/image's host
                  allow-list cannot apply; a plain img is the honest choice. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.name}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
