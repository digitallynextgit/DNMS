"use client"

import { useState, type FormEvent } from "react"
import { ArrowRight, Check, AlertCircle } from "lucide-react"

import { cn } from "@/lib/utils"

type Status = "idle" | "loading" | "success" | "error"

const TOPICS = [
  { value: "sales", label: "Talk to sales" },
  { value: "demo", label: "Book a demo" },
  { value: "support", label: "Product support" },
  { value: "privacy", label: "Privacy or data request" },
  { value: "other", label: "Something else" },
] as const

const field =
  "border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary/50 w-full rounded-[6px] border px-3 py-2.5 text-sm shadow-sm outline-none transition-colors"

/** Public contact form. Posts to /api/public/contact, which needs no session. */
export function ContactForm({ className }: { className?: string }) {
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (status === "loading") return
    setStatus("loading")
    setError(null)

    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>

    try {
      const res = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.success) {
        setStatus("success")
        form.reset()
      } else {
        // Surface the server's reason when it gave one - "that email looks
        // wrong" is actionable, "something went wrong" is not.
        setError(json?.error?.message ?? null)
        setStatus("error")
      }
    } catch {
      setStatus("error")
    }
  }

  if (status === "success") {
    return (
      <div
        className={cn(
          "border-border/70 bg-card/70 rounded-[6px] border p-6 text-center",
          className,
        )}
      >
        <Check className="mx-auto h-8 w-8 text-emerald-500" />
        <p className="mt-3 text-lg font-semibold">Message sent</p>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Thanks for getting in touch. We reply to most messages within one business day.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="text-muted-foreground hover:text-foreground mt-5 text-sm underline underline-offset-4"
        >
          Send another message
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className={cn("space-y-4", className)}>
      {/* Honeypot: invisible to people, irresistible to naive bots. The server
          silently accepts and discards anything that fills it in. */}
      <div aria-hidden className="absolute -left-[9999px]">
        <label htmlFor="company_website">Do not fill this in</label>
        <input id="company_website" name="company_website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
            Your name
          </label>
          <input id="name" name="name" required maxLength={120} className={field} />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
            Work email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            maxLength={200}
            placeholder="you@company.com"
            className={field}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="company" className="mb-1.5 block text-sm font-medium">
            Company <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <input id="company" name="company" maxLength={160} className={field} />
        </div>
        <div>
          <label htmlFor="topic" className="mb-1.5 block text-sm font-medium">
            What is this about?
          </label>
          <select id="topic" name="topic" defaultValue="sales" className={field}>
            {TOPICS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="message" className="mb-1.5 block text-sm font-medium">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          minLength={10}
          maxLength={4000}
          className={cn(field, "resize-y")}
          placeholder="Tell us about your team size and what you are trying to solve."
        />
      </div>

      {status === "error" && (
        <p className="text-destructive flex items-start gap-2 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error ?? "Something went wrong. Please try again, or email us directly."}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4 pt-1">
        <button
          type="submit"
          disabled={status === "loading"}
          className="bg-primary text-primary-foreground inline-flex items-center justify-center gap-1.5 rounded-[6px] px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {status === "loading" ? "Sending…" : "Send message"}
          <ArrowRight className="h-4 w-4" />
        </button>
        <p className="text-muted-foreground text-xs">
          We use your details only to reply. See our privacy policy.
        </p>
      </div>
    </form>
  )
}
