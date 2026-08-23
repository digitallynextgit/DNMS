"use client"

/**
 * The one message composer: emoji · attachments · field · send-or-mic.
 *
 * Personal Chat and a project's Messages tab had their own copies. They drifted
 * - different padding, a second bordered bar around the controls in one of them,
 * different button sizes, one field that grew with the text and one that did not
 * - and every fix had to be made twice or the two surfaces stopped matching.
 * There is one now; the only difference either side may express is a prop.
 *
 * `members` is what makes it a mention field: pass a list and the textarea gains
 * the @ picker, omit it and it is a plain one. Everything around it is identical
 * either way.
 */

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

/** Field styling, shared by the plain and the mention variant so the two are
 *  pixel-identical. `max-h-32` is where growing stops and scrolling starts. */
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
        // Enter sends, Shift+Enter is a newline - the convention every chat app
        // has trained people into.
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
  /** Pass a member list to turn the field into an @mention field. */
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
  // Remember the latest mention ids the field reported, so inserting an emoji
  // does not clobber them (UI-03). An appended emoji cannot invalidate an
  // existing "@Name" token, so the ids stay correct.
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

      {/* The wrapper is the positioning anchor the @ dropdown hangs off, and it
          is what carries flex-1 - the field itself is w-full inside it. */}
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

      {/* Arrow when there is something typed, mic when there is not - the same
          swap every messaging app makes, so the primary action is never
          ambiguous. The recorder stays mounted while it is running: remounting
          it would drop the MediaRecorder and the clip with it. */}
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
