"use client"

import * as React from "react"
import { Sparkles, X, Send, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MarkdownLite } from "@/components/shared/markdown-lite"
import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"
import { useAiAssistantStore } from "@/stores/ai-assistant-store"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

const SUGGESTIONS = [
  "What's overdue right now?",
  "What is my team working on?",
  "Which projects are at risk?",
  "Who has pending evaluations?",
]

/**
 * The assistant panel, pinned bottom-right. Answers come from /api/ai/chat,
 * which is grounded in a permission-scoped snapshot of the caller's data - it
 * can't see anything they can't.
 *
 * The launcher is NOT here: as a floating bubble it sat on top of whatever was
 * in the bottom-right corner of the page (the chat Send button, most visibly).
 * It lives in the Topbar now and drives this through `useAiAssistantStore`.
 */
export function AiAssistant() {
  const open = useAiAssistantStore((s) => s.open)
  const setOpen = useAiAssistantStore((s) => s.setOpen)
  const [input, setInput] = React.useState("")
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [pending, setPending] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  // Keep the newest message in view.
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, pending])

  React.useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  async function send(text: string) {
    const question = text.trim()
    if (!question || pending) return
    const next: ChatMessage[] = [...messages, { role: "user", content: question }]
    setMessages(next)
    setInput("")
    setPending(true)
    try {
      const res = await apiFetch<{ data: { reply: string } }>("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      })
      setMessages([...next, { role: "assistant", content: res.data.reply }])
    } catch (e) {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: e instanceof Error ? e.message : "Sorry - I couldn't answer that just now.",
        },
      ])
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      {/* Panel - opened from the Topbar launcher.
          Sits ABOVE the mobile tab bar rather than on top of it: the bar is a
          real layout row (~4.5rem incl. its safe-area padding), and a fixed
          panel at bottom-5 covered it along with whatever tab you were on.
          dvh so iOS Safari's collapsing chrome is excluded from the height. */}
      {open && (
        <div className="bg-card fixed right-5 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 flex h-[min(560px,calc(100dvh-12rem))] w-[min(400px,calc(100vw-2.5rem))] flex-col rounded-[2px] border shadow-2xl md:bottom-5 md:h-[min(560px,calc(100dvh-6rem))]">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-semibold">Ask DNMS</span>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setMessages([])}
                >
                  Clear
                </Button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
                className="text-muted-foreground hover:text-foreground flex h-7 w-7 items-center justify-center rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && !pending && (
              <div className="space-y-3">
                <p className="text-muted-foreground text-sm">
                  Ask about projects, tasks, people or performance. I only see what you&apos;re
                  allowed to see.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      className="hover:bg-accent rounded-[2px] border px-2.5 py-1 text-xs"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-[2px] px-3 py-2 text-sm",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                      : "bg-muted leading-relaxed",
                  )}
                >
                  {m.role === "user" ? m.content : <MarkdownLite content={m.content} />}
                </div>
              </div>
            ))}

            {pending && (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
              </div>
            )}
          </div>

          <div className="border-t p-2">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    void send(input)
                  }
                }}
                rows={1}
                placeholder="Ask anything…"
                style={{ outline: "none", boxShadow: "none" }}
                className="text-foreground max-h-28 min-h-9 flex-1 resize-none rounded-[2px] border bg-transparent px-3 py-2 text-sm"
              />
              <Button
                size="icon"
                className="h-9 w-9 shrink-0"
                disabled={pending || !input.trim()}
                onClick={() => void send(input)}
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
