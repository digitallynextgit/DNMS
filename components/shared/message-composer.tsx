"use client"

// The one message composer (emoji, attachments, field, send-or-mic) for Chat and project Messages.
// Pass `members` to make the field an @mention field.

import * as React from "react"
import { Send } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { AttachmentMenu } from "@/components/shared/attachment-menu"
import { VoiceRecorder } from "@/components/shared/voice-recorder"
import { EmojiPicker } from "@/components/shared/emoji-picker"
import { MentionTextarea, type MentionMember } from "@/components/shared/mention-textarea"
import { useAutoGrow } from "@/hooks/use-auto-grow"

/** Shared by both field variants; `max-h-32` is where growing stops. */
const FIELD_CLASS = "max-h-32 min-h-9 w-full resize-none rounded-sm text-sm"

function PlainField({
  value,
  onChange,
  onSubmit,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  placeholder: string
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null)
  useAutoGrow(ref, value)
  return (
    <Textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()
          onSubmit()
        }
      }}
      rows={1}
      placeholder={placeholder}
      className={FIELD_CLASS}
    />
  )
}

export function MessageComposer({
  value,
  onChange,
  onSubmit,
  placeholder = "Type a message",
  members,
  uploading = false,
  sending = false,
  recording,
  onRecordingChange,
  onFiles,
  onPoll,
  onEvent,
  onContact,
  onVoice,
}: {
  value: string
  /** `mentionIds` is only populated by the mention variant. */
  onChange: (value: string, mentionIds: string[]) => void
  onSubmit: () => void
  placeholder?: string
  members?: MentionMember[]
  uploading?: boolean
  sending?: boolean
  recording: boolean
  onRecordingChange: (recording: boolean) => void
  onFiles: (files: File[], opts?: { asSticker?: boolean }) => void
  onPoll: () => void
  onEvent: () => void
  onContact: () => void
  onVoice: (blob: Blob, durationSec: number, waveform: number[]) => Promise<void>
}) {
  // Remember the last mention ids so inserting an emoji doesn't clobber them.
  const lastMentionIds = React.useRef<string[]>([])
  const handleChange = (v: string, ids: string[]) => {
    lastMentionIds.current = ids
    onChange(v, ids)
  }

  return (
    <div className="bg-card flex shrink-0 items-end gap-1 border-t p-2">
      {!recording && (
        <>
          <EmojiPicker
            onPick={(emoji) => onChange(value + emoji, lastMentionIds.current)}
            closeOnPick
          />

          <AttachmentMenu
            disabled={uploading}
            busy={uploading}
            onFiles={onFiles}
            onPoll={onPoll}
            onEvent={onEvent}
            onContact={onContact}
          />
        </>
      )}

      {/* Positioning anchor for the @ dropdown; it carries flex-1. */}
      <div className={cn("min-w-0 flex-1", recording && "hidden")}>
        {members ? (
          <MentionTextarea
            value={value}
            onChange={handleChange}
            members={members}
            rows={1}
            dropup
            autoGrow
            onSubmit={onSubmit}
            placeholder={placeholder}
            className={FIELD_CLASS}
          />
        ) : (
          <PlainField
            value={value}
            onChange={(v) => onChange(v, [])}
            onSubmit={onSubmit}
            placeholder={placeholder}
          />
        )}
      </div>

      {/* Send when there's text, mic when not. The recorder stays mounted while running, or the clip is lost. */}
      {!recording && value.trim() ? (
        <Button
          size="icon"
          className="shrink-0 rounded-sm"
          disabled={sending}
          onClick={onSubmit}
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </Button>
      ) : (
        <VoiceRecorder disabled={uploading} onActiveChange={onRecordingChange} onSend={onVoice} />
      )}
    </div>
  )
}
