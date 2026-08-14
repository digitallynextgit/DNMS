"use client"

// =============================================================================
// Minimal WYSIWYG editor
// =============================================================================
// Deliberately dependency-free. A full editor (TipTap/Lexical/Quill) is a large
// dependency for what an email body needs, and email HTML has to stay simple
// anyway - Outlook ignores most of what a rich editor emits.
//
// Built on contentEditable + document.execCommand. execCommand is formally
// deprecated but is implemented everywhere and is the only API that gives
// inline formatting without a full editing model; the alternative is hand-rolling
// selection and range handling, which is exactly the complexity we are avoiding.
// =============================================================================

import * as React from "react"
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link2,
  Heading2,
  RemoveFormatting,
  Braces,
  ImagePlus,
  Loader2,
  Trash2,
} from "lucide-react"

import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BUILTIN_VARS } from "../lib/merge"

export function RichTextEditor({
  value,
  onChange,
  customVars = [],
  onUploadImage,
  onDeleteImage,
  className,
}: {
  value: string
  onChange: (html: string) => void
  /** Extra variable names discovered on the recipient list. */
  customVars?: string[]
  /** Uploads and returns a PUBLIC url. Omit to hide the image button. */
  onUploadImage?: (file: File) => Promise<string>
  /** Called after an image is removed, so its file can be reclaimed. */
  onDeleteImage?: (src: string) => void
  className?: string
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  // The toolbar button opens a file dialog, which blurs the editable - so the
  // caret is stashed on mousedown, before that happens.
  const savedRange = React.useRef<Range | null>(null)
  // The image the user clicked, plus where to float its Remove button.
  const [picked, setPicked] = React.useState<{
    el: HTMLImageElement
    top: number
    left: number
  } | null>(null)

  // Only write into the DOM when the incoming value genuinely differs from what
  // is already there. Assigning innerHTML on every render would collapse the
  // caret to the start on every keystroke.
  React.useEffect(() => {
    const el = ref.current
    if (el && el.innerHTML !== value) el.innerHTML = value || ""
  }, [value])

  const exec = (command: string, arg?: string) => {
    ref.current?.focus()
    document.execCommand(command, false, arg)
    onChange(ref.current?.innerHTML ?? "")
  }

  const insertVar = (key: string) => {
    ref.current?.focus()
    // insertText, not insertHTML: the braces must land as literal characters, or
    // the browser escapes them into entities and the renderer stops matching.
    document.execCommand("insertText", false, `{{${key}}}`)
    onChange(ref.current?.innerHTML ?? "")
  }

  /**
   * Insert HTML where the caret was.
   *
   * An upload is async, and the selection is gone by the time it resolves - the
   * file dialog, or simply the round trip, blurs the editable. So the Range is
   * captured up front and restored before inserting; without this every image
   * lands at the start of the document.
   */
  function insertAtRange(html: string, saved: Range | null) {
    const el = ref.current
    if (!el) return
    el.focus()
    if (saved) {
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(saved)
    }
    document.execCommand("insertHTML", false, html)
    onChange(el.innerHTML)
  }

  /** Current caret, or null when the editable isn't focused. */
  function currentRange(): Range | null {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return null
    const range = sel.getRangeAt(0)
    return ref.current?.contains(range.commonAncestorContainer) ? range.cloneRange() : null
  }

  /** Upload image files and drop them in, one after another. */
  async function uploadAndInsert(files: File[], saved: Range | null) {
    if (!onUploadImage) return
    setUploading(true)
    try {
      for (const file of files) {
        const url = await onUploadImage(file)
        // Sizing is INLINE, not a class: mail clients strip <style> blocks, so
        // without it a wide image blows out the layout on a phone.
        insertAtRange(
          `<img src="${url}" alt="" style="max-width:100%;height:auto;display:block;" />`,
          saved,
        )
        saved = currentRange() // continue after the image just inserted
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload the image")
    } finally {
      setUploading(false)
    }
  }

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !onUploadImage) return
    setUploading(true)
    try {
      const url = await onUploadImage(file)
      ref.current?.focus()
      // Sizing is INLINE, not a class: mail clients strip <style> blocks, so
      // without it a wide image blows out the layout on a phone.
      document.execCommand(
        "insertHTML",
        false,
        `<img src="${url}" alt="" style="max-width:100%;height:auto;display:block;" />`,
      )
      onChange(ref.current?.innerHTML ?? "")
    } finally {
      setUploading(false)
    }
  }

  /**
   * Clicking an image selects it.
   *
   * contentEditable does not reliably select an <img> on click, which is why
   * Backspace appeared to do nothing - there was no selection to delete. Wrapping
   * the node in a Range makes Delete/Backspace work AND gives us somewhere to
   * anchor an explicit Remove button, since "click it then press a key" is not a
   * discoverable way to remove a picture.
   */
  function pickImage(img: HTMLImageElement) {
    const el = ref.current
    if (!el) return
    const range = document.createRange()
    range.selectNode(img)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    setPicked({ el: img, top: img.offsetTop - el.scrollTop, left: img.offsetLeft })
  }

  function removePicked() {
    const el = ref.current
    const img = picked?.el
    if (!el || !img) return
    const src = img.getAttribute("src") ?? ""
    img.remove()
    setPicked(null)
    onChange(el.innerHTML)
    // Reclaim the file only after it is out of the document, so a failed delete
    // never leaves a live <img> pointing at an object we already removed.
    if (src) onDeleteImage?.(src)
  }

  const addLink = () => {
    const url = window.prompt("Link URL", "https://")
    if (!url) return
    exec("createLink", url)
  }

  const tools = [
    { icon: Bold, label: "Bold", run: () => exec("bold") },
    { icon: Italic, label: "Italic", run: () => exec("italic") },
    { icon: Underline, label: "Underline", run: () => exec("underline") },
    { icon: Heading2, label: "Heading", run: () => exec("formatBlock", "<h2>") },
    { icon: List, label: "Bulleted list", run: () => exec("insertUnorderedList") },
    { icon: ListOrdered, label: "Numbered list", run: () => exec("insertOrderedList") },
    { icon: Link2, label: "Link", run: addLink },
    { icon: RemoveFormatting, label: "Clear formatting", run: () => exec("removeFormat") },
  ]

  return (
    <div className={cn("overflow-hidden rounded-md border", className)}>
      <div className="bg-muted/40 flex flex-wrap items-center gap-0.5 border-b p-1">
        {tools.map((t) => (
          <Button
            key={t.label}
            type="button"
            variant="ghost"
            size="icon-sm"
            title={t.label}
            aria-label={t.label}
            // onMouseDown + preventDefault: a click would blur the editable and
            // drop the selection before the command runs.
            onMouseDown={(e) => {
              e.preventDefault()
              t.run()
            }}
          >
            <t.icon className="h-3.5 w-3.5" />
          </Button>
        ))}

        {onUploadImage && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Insert image"
            aria-label="Insert image"
            disabled={uploading}
            onMouseDown={(e) => {
              e.preventDefault()
              savedRange.current = currentRange()
              fileRef.current?.click()
            }}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImagePlus className="h-3.5 w-3.5" />
            )}
          </Button>
        )}

        <div className="bg-border mx-1 h-4 w-px" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
              <Braces className="h-3.5 w-3.5" />
              Variable
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-xs">Always available</DropdownMenuLabel>
            {BUILTIN_VARS.map((v) => (
              <DropdownMenuItem
                key={v.key}
                onSelect={() => insertVar(v.key)}
                className="flex-col items-start gap-0 text-xs"
              >
                <span className="font-mono">{`{{${v.key}}}`}</span>
                <span className="text-muted-foreground text-[11px]">{v.description}</span>
              </DropdownMenuItem>
            ))}
            {customVars.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs">From your list</DropdownMenuLabel>
                {customVars.map((key) => (
                  <DropdownMenuItem
                    key={key}
                    onSelect={() => insertVar(key)}
                    className="font-mono text-xs"
                  >
                    {`{{${key}}}`}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleImage}
        className="hidden"
        aria-hidden
      />

      <div className="relative">
        {picked && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute z-10 h-7 gap-1.5 text-xs shadow-md"
            style={{ top: picked.top + 8, left: picked.left + 8 }}
            onMouseDown={(e) => {
              e.preventDefault()
              removePicked()
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove image
          </Button>
        )}

        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Email body"
          onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
          onClick={(e) => {
            const target = e.target as HTMLElement
            if (target.tagName === "IMG") pickImage(target as HTMLImageElement)
            else setPicked(null)
          }}
          onKeyDown={(e) => {
            // Delete/Backspace on a picked image goes through the same path as the
            // button, so the file is reclaimed either way.
            if ((e.key === "Delete" || e.key === "Backspace") && picked) {
              e.preventDefault()
              removePicked()
            }
          }}
          onScroll={() => setPicked(null)}
          // Pasted IMAGES are uploaded and embedded - a screenshot or an image
          // copied from anywhere just works. Pasted TEXT is still flattened to
          // plain text, because Word and web pages drag in pages of styles and
          // classes that break in every email client.
          onPaste={(e) => {
            const images = Array.from(e.clipboardData.files).filter((f) =>
              f.type.startsWith("image/"),
            )
            if (images.length > 0 && onUploadImage) {
              e.preventDefault()
              void uploadAndInsert(images, currentRange())
              return
            }
            e.preventDefault()
            const text = e.clipboardData.getData("text/plain")
            document.execCommand("insertText", false, text)
            onChange(ref.current?.innerHTML ?? "")
          }}
          // Drag an image straight in from the desktop.
          onDrop={(e) => {
            const images = Array.from(e.dataTransfer.files).filter((f) =>
              f.type.startsWith("image/"),
            )
            if (images.length === 0 || !onUploadImage) return
            e.preventDefault()
            void uploadAndInsert(images, currentRange())
          }}
          onDragOver={(e) => {
            if (onUploadImage && e.dataTransfer.types.includes("Files")) e.preventDefault()
          }}
          className="min-h-64 overflow-y-auto px-3 py-2 text-sm outline-none [&_a]:text-blue-600 [&_a]:underline [&_h2]:mt-2 [&_h2]:mb-1 [&_h2]:text-base [&_h2]:font-semibold [&_img]:my-2 [&_img]:max-w-full [&_img]:cursor-pointer [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
        />
      </div>
    </div>
  )
}
