"use client"

import { useCallback, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

/**
 * A project's description under its header: two lines, then "Read more" opens the whole text.
 * Key it by the text, so an edited description is measured afresh.
 */
export function ProjectDescription({
  text,
  projectName,
  className,
}: {
  text: string
  projectName: string
  className?: string
}) {
  const [clamped, setClamped] = useState(false)
  const [open, setOpen] = useState(false)

  // Only offer "Read more" when the text really runs past two lines at this width.
  const measure = useCallback((el: HTMLParagraphElement | null) => {
    if (!el) return
    const observer = new ResizeObserver(() => setClamped(el.scrollHeight > el.clientHeight + 1))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className={cn("max-w-4xl", className)}>
      <p
        ref={measure}
        className="text-muted-foreground line-clamp-2 text-sm leading-relaxed whitespace-pre-line"
      >
        {text}
      </p>
      {clamped ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-foreground mt-1 text-sm font-medium hover:underline focus-visible:underline focus-visible:outline-none"
        >
          Read more
        </button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        {/* Spacing-scale width: this theme's max-w-2xl is the page container, not a dialog. */}
        <DialogContent className="max-w-168 lg:max-w-168">
          <DialogHeader>
            <DialogTitle>{projectName}</DialogTitle>
          </DialogHeader>
          <DialogDescription className="text-foreground/90 text-sm leading-relaxed whitespace-pre-line">
            {text}
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </div>
  )
}
