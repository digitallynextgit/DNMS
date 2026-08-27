"use client"

/**
 * Subject + body + live preview, shared by the template editor and the campaign
 * composer so the two can never drift apart.
 *
 * Two authoring modes over ONE stored value: both produce HTML, because that is
 * what gets sent either way. `mode` only decides which editor opens - switching
 * to HTML shows you exactly what the rich editor produced, and switching back
 * keeps it.
 */

import * as React from "react"
import { PenLine, Code2, ImagePlus, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RichTextEditor } from "./rich-text-editor"
import { EmailPreview } from "./email-preview"
import { BUILTIN_VARS, extractVars } from "../lib/merge"

export type BodyMode = "RICH" | "HTML"

export function BodyComposer({
  subject,
  onSubjectChange,
  bodyHtml,
  onBodyChange,
  mode,
  onModeChange,
  customVars = [],
  onUploadImage,
  onDeleteImage,
  fromName,
  fromEmail,
}: {
  subject: string
  onSubjectChange: (v: string) => void
  bodyHtml: string
  onBodyChange: (v: string) => void
  mode: BodyMode
  onModeChange: (m: BodyMode) => void
  /** Variable names seen on this project's recipient list. */
  customVars?: string[]
  /** Uploads an image and returns a PUBLIC url for the <img src>. */
  onUploadImage?: (file: File) => Promise<string>
  /** Reclaims an image's file once it is removed from the body. */
  onDeleteImage?: (src: string) => void
  fromName?: string
  fromEmail?: string
}) {
  const used = React.useMemo(() => extractVars(subject, bodyHtml), [subject, bodyHtml])
  const htmlRef = React.useRef<HTMLTextAreaElement>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)

  /**
   * HTML mode's own image insert. The rich editor has its own button; a raw
   * textarea has no caret API of its own, so the tag is spliced in at
   * selectionStart rather than appended - pasting an image at the end of the
   * document is almost never where you wanted it.
   */
  async function handleHtmlImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || !onUploadImage) return
    setUploading(true)
    try {
      const url = await onUploadImage(file)
      const tag = `<img src="${url}" alt="" style="max-width:100%;height:auto;display:block;border:0;" />`
      const el = htmlRef.current
      const at = el?.selectionStart ?? bodyHtml.length
      onBodyChange(bodyHtml.slice(0, at) + tag + bodyHtml.slice(at))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload the image")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">
          Subject<span className="text-destructive"> *</span>
        </Label>
        <Input
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="Hi {{first_name|there}}, a quick update"
          aria-label="Hi {{first_name|there}}, a quick update"
          className="h-9 text-sm"
        />
        <p className="text-muted-foreground text-[11px]">
          Variables work here too. <span className="font-mono">{"{{name|there}}"}</span> falls back
          to “there” when the name is missing.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-xs">
          Body<span className="text-destructive"> *</span>
        </Label>
        <div className="bg-muted inline-flex rounded-[2px] p-0.5">
          {(
            [
              { value: "RICH", label: "Editor", icon: PenLine },
              { value: "HTML", label: "HTML", icon: Code2 },
            ] as const
          ).map((m) => (
            <Button
              key={m.value}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onModeChange(m.value)}
              className={cn(
                "h-7 gap-1.5 rounded-[2px] px-2.5 text-xs",
                mode === m.value && "bg-background text-foreground shadow-sm",
              )}
            >
              <m.icon className="h-3.5 w-3.5" />
              {m.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Editor and preview side by side, so a change is visible as it is typed. */}
      <div className="grid gap-3 lg:grid-cols-2">
        {mode === "RICH" ? (
          <RichTextEditor
            value={bodyHtml}
            onChange={onBodyChange}
            customVars={customVars}
            onUploadImage={onUploadImage}
            onDeleteImage={onDeleteImage}
          />
        ) : (
          <div className="space-y-2">
            <Textarea
              ref={htmlRef}
              value={bodyHtml}
              onChange={(e) => onBodyChange(e.target.value)}
              rows={16}
              placeholder={"<p>Hi {{first_name|there}},</p>\n<p>…</p>"}
              className="min-h-64 font-mono text-xs"
            />
            {onUploadImage && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="h-3.5 w-3.5" />
                )}
                Insert image at cursor
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleHtmlImage}
              className="hidden"
              aria-hidden
            />
          </div>
        )}

        <EmailPreview
          subject={subject}
          bodyHtml={bodyHtml}
          fromName={fromName}
          fromEmail={fromEmail}
        />
      </div>

      <div className="space-y-1.5">
        <p className="text-muted-foreground text-[11px]">
          Images are uploaded and hosted, so they load in the recipient&apos;s inbox. Many clients
          hide images until the reader allows them - never put essential wording inside one.
        </p>
        <p className="text-muted-foreground text-[11px]">
          Any <span className="font-mono">{"{{variable}}"}</span> works - it does not have to exist
          on the list. Unknown ones render empty rather than printing the braces.
        </p>
        {used.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-muted-foreground text-[11px]">In use:</span>
            {used.map((v) => (
              <Badge
                key={v}
                variant={
                  BUILTIN_VARS.some((b) => b.key === v) || customVars.includes(v)
                    ? "secondary"
                    : "outline"
                }
                className="font-mono text-[10px]"
              >
                {`{{${v}}}`}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
