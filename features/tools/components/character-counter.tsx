"use client"

import { useDeferredValue, useMemo, useState, type ReactNode } from "react"
import { CaseSensitive, ChevronDown, Copy, Eraser, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  INSTAGRAM_MAX_HASHTAGS,
  X_LINK_LENGTH,
  formatReadingTime,
  limitTone,
  removeBlankLines,
  removeExtraSpaces,
  smsInfo,
  textStats,
  toLowerCase,
  toSentenceCase,
  toTitleCase,
  toUpperCase,
  xLength,
  type LimitTone,
} from "../lib/text-stats"
import { ToolPage } from "./tool-page"

const num = (n: number) => n.toLocaleString("en-IN")

const TONE_BAR: Record<LimitTone, string> = {
  ok: "bg-green-500",
  near: "bg-amber-500",
  over: "bg-red-500",
}
const TONE_TEXT: Record<LimitTone, string> = {
  ok: "text-muted-foreground",
  near: "text-amber-700 dark:text-amber-400",
  over: "text-red-600 dark:text-red-400",
}

interface LimitRowData {
  id: string
  label: string
  count: number
  limit: number
  /** A recommendation, not a hard limit: never turns red. */
  guide?: boolean
  note?: ReactNode
  extra?: ReactNode
}

const CASE_ACTIONS = [
  { label: "UPPERCASE", run: toUpperCase, done: "Changed to UPPERCASE" },
  { label: "lowercase", run: toLowerCase, done: "Changed to lowercase" },
  { label: "Title Case", run: toTitleCase, done: "Changed to Title Case" },
  { label: "Sentence case", run: toSentenceCase, done: "Changed to Sentence case" },
] as const

const TIDY_ACTIONS = [
  { label: "Remove extra spaces", run: removeExtraSpaces, done: "Extra spaces removed" },
  { label: "Remove blank lines", run: removeBlankLines, done: "Blank lines removed" },
] as const

export function CharacterCounter() {
  const [text, setText] = useState("")
  // Counting catches up a beat after typing, so long texts stay snappy.
  const deferred = useDeferredValue(text)
  const stats = useMemo(() => textStats(deferred), [deferred])
  const xCount = useMemo(() => xLength(deferred), [deferred])
  const sms = useMemo(() => smsInfo(deferred), [deferred])
  const empty = text.length === 0
  const chars = stats.characters
  const hasAngleBrackets = /[<>]/.test(deferred)

  const ytNote = hasAngleBrackets ? (
    <span className="text-red-600 dark:text-red-400">YouTube doesn&apos;t allow &lt; or &gt;.</span>
  ) : undefined

  const rows: LimitRowData[] = [
    {
      id: "x",
      label: "X (Twitter) post",
      count: xCount,
      limit: 280,
      note: `Counted the X way: every link is ${X_LINK_LENGTH}, an emoji is 2.`,
    },
    {
      id: "instagram",
      label: "Instagram caption",
      count: chars,
      limit: 2200,
      note: chars > 125 ? "Only the first 125 or so show before “more”." : undefined,
      extra: (
        <p className={cn("text-xs", TONE_TEXT[limitTone(stats.hashtags, INSTAGRAM_MAX_HASHTAGS)])}>
          Hashtags: {stats.hashtags} / {INSTAGRAM_MAX_HASHTAGS}
          {stats.hashtags > INSTAGRAM_MAX_HASHTAGS &&
            ` - Instagram allows up to ${INSTAGRAM_MAX_HASHTAGS} per post.`}
        </p>
      ),
    },
    { id: "linkedin", label: "LinkedIn post", count: chars, limit: 3000 },
    {
      id: "facebook",
      label: "Facebook post",
      count: chars,
      limit: 80,
      guide: true,
      note: "A guide, not a limit: posts under 80 characters tend to get more engagement. The real limit is 63,206.",
    },
    { id: "yt-title", label: "YouTube title", count: chars, limit: 100, note: ytNote },
    { id: "yt-desc", label: "YouTube description", count: chars, limit: 5000, note: ytNote },
    {
      id: "meta-title",
      label: "Google meta title",
      count: chars,
      limit: 60,
      note: "Google cuts titles by width, so about 60 characters.",
    },
    {
      id: "meta-desc",
      label: "Google meta description",
      count: chars,
      limit: 160,
      note: "Phones show about 120.",
    },
  ]

  function change(next: string, done: string) {
    const before = text
    if (next === before) {
      toast("Nothing to change")
      return
    }
    setText(next)
    toast.success(done, { action: { label: "Undo", onClick: () => setText(before) } })
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Text copied")
    } catch {
      toast.error("Your browser blocked copying - select the text and copy it yourself")
    }
  }

  return (
    <ToolPage slug="character-counter">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <Card className="min-w-0">
          <CardContent className="space-y-5 p-5">
            <div className="space-y-2">
              <Label htmlFor="cc-text">Your text</Label>
              <Textarea
                id="cc-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type or paste a caption, post, title or description..."
                rows={10}
                className="min-h-56 resize-y"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-1.5" disabled={empty} onClick={copy}>
                <Copy />
                Copy
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-1.5" disabled={empty}>
                    <CaseSensitive />
                    Change case
                    <ChevronDown className="text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {CASE_ACTIONS.map((a) => (
                    <DropdownMenuItem key={a.label} onSelect={() => change(a.run(text), a.done)}>
                      {a.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-1.5" disabled={empty}>
                    <Sparkles />
                    Tidy up
                    <ChevronDown className="text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {TIDY_ACTIONS.map((a) => (
                    <DropdownMenuItem key={a.label} onSelect={() => change(a.run(text), a.done)}>
                      {a.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-destructive gap-1.5"
                disabled={empty}
                onClick={() => change("", "Text cleared")}
              >
                <Eraser />
                Clear
              </Button>
            </div>
            <p className="text-muted-foreground -mt-2 text-xs">
              Links keep their capitals when you change case, so short links still work.
            </p>

            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Stat label="Characters" value={num(stats.characters)} big />
              <Stat label="Words" value={num(stats.words)} big />
              <Stat label="Reading time" value={formatReadingTime(stats.readingSeconds)} big />
              <Stat label="Without spaces" value={num(stats.charactersNoSpaces)} />
              <Stat label="Sentences" value={num(stats.sentences)} />
              <Stat label="Paragraphs" value={num(stats.paragraphs)} />
              <Stat label="Hashtags" value={num(stats.hashtags)} />
              <Stat label="Mentions" value={num(stats.mentions)} />
              <Stat label="Emojis" value={num(stats.emojis)} />
            </dl>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Emoji and Hindi letters count the way you see them - &quot;👍🏽&quot; is one character.
              Reading time is at 200 words a minute. Your text stays in your browser.
            </p>
          </CardContent>
        </Card>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardContent className="space-y-4 p-5">
              <h2 className="text-sm font-semibold">Limits</h2>
              {rows.map((row) => (
                <LimitRow key={row.id} row={row} />
              ))}
              <SmsRow sms={sms} />
            </CardContent>
          </Card>
        </div>
      </div>
    </ToolPage>
  )
}

function Stat({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="bg-muted/30 rounded-sm border px-3 py-2">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd
        className={cn("font-semibold tracking-tight tabular-nums", big ? "text-xl" : "text-base")}
      >
        {value}
      </dd>
    </div>
  )
}

function Bar({
  label,
  value,
  max,
  tone,
  valueText,
}: {
  label: string
  value: number
  max: number
  tone: LimitTone
  valueText: string
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      aria-valuetext={valueText}
      className="bg-muted h-1.5 w-full overflow-hidden rounded-sm"
    >
      <div
        className={cn("h-full rounded-sm transition-[width] duration-200", TONE_BAR[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function LimitRow({ row }: { row: LimitRowData }) {
  const tone = limitTone(row.count, row.limit, row.guide)
  const diff = row.limit - row.count
  const status =
    diff >= 0
      ? `${num(diff)} left`
      : row.guide
        ? `${num(-diff)} over the guide`
        : `${num(-diff)} too many`
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">
          {row.label}
          {row.guide && (
            <span className="text-muted-foreground ml-1.5 rounded-sm border px-1 py-px text-[10px] font-normal tracking-wide uppercase">
              Guide
            </span>
          )}
        </span>
        <span className={cn("shrink-0 text-xs tabular-nums", TONE_TEXT[tone])}>
          {num(row.count)} / {num(row.limit)}
        </span>
      </div>
      <Bar
        label={row.label}
        value={row.count}
        max={row.limit}
        tone={tone}
        valueText={`${num(row.count)} of ${num(row.limit)} - ${status}`}
      />
      <p className="text-xs">
        <span className={cn(TONE_TEXT[tone], tone === "ok" && "text-foreground/80")}>{status}</span>
        {row.note && <span className="text-muted-foreground"> · {row.note}</span>}
      </p>
      {row.extra}
    </div>
  )
}

function SmsRow({ sms }: { sms: ReturnType<typeof smsInfo> }) {
  const tone: LimitTone = sms.parts > 1 ? "near" : limitTone(sms.units, sms.single)
  const unicode = sms.encoding === "unicode"
  const capacity = sms.parts <= 1 ? sms.single : sms.perPart
  const used = capacity - sms.left
  return (
    <div className="space-y-1.5 border-t pt-4">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">SMS</span>
        <span className={cn("shrink-0 text-xs tabular-nums", TONE_TEXT[tone])}>
          {sms.parts} {sms.parts === 1 ? "message" : "messages"}
        </span>
      </div>
      <Bar
        label="SMS"
        value={used}
        max={capacity}
        tone={tone}
        valueText={`${sms.parts} messages, ${sms.left} characters left in the last one`}
      />
      <p className="text-xs">
        <span className="text-foreground/80">{num(sms.left)} left in this message</span>
        <span className="text-muted-foreground">
          {" "}
          ·{" "}
          {unicode
            ? `${sms.single} per SMS because of ${sms.unusual.join(" ")}${sms.unusual.length >= 5 ? " and more" : ""} (Hindi, emoji, ₹ or curly quotes). Long texts split into parts of ${sms.perPart}.`
            : `Plain English: ${sms.single} per SMS. Long texts split into parts of ${sms.perPart}.`}
        </span>
      </p>
    </div>
  )
}
