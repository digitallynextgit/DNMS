"use client"

import { useState, type FormEvent } from "react"
import { ArrowRight, Check } from "lucide-react"

import { cn } from "@/lib/utils"

type Status = "idle" | "loading" | "success" | "error"

/** Homepage newsletter sign-up. Posts to the public /api/marketing/subscribe. */
export function NewsletterForm({ className }: { className?: string }) {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<Status>("idle")

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (status === "loading") return
    setStatus("loading")
    try {
      const res = await fetch("/api/marketing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.success) {
        setStatus("success")
        setEmail("")
      } else {
        setStatus("error")
      }
    } catch {
      setStatus("error")
    }
  }

  if (status === "success") {
    return (
      <div
        className={cn("flex items-center gap-2 text-sm font-medium text-emerald-500", className)}
      >
        <Check className="h-4 w-4 shrink-0" />
        Thanks — you&rsquo;re on the list.
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className={cn("w-full", className)}>
      <div className="border-border bg-card focus-within:border-primary/50 flex items-center gap-2 rounded-[6px] border p-1.5 shadow-sm transition-colors">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (status === "error") setStatus("idle")
          }}
          placeholder="you@company.com"
          aria-label="Email address"
          className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent px-3 py-1.5 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="bg-primary text-primary-foreground inline-flex shrink-0 items-center gap-1.5 rounded-[6px] px-4 py-1.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {status === "loading" ? "Subscribing…" : "Subscribe"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      {status === "error" ? (
        <p className="text-destructive mt-2 text-xs">Something went wrong. Please try again.</p>
      ) : (
        <p className="text-muted-foreground mt-2 text-xs">No spam. Unsubscribe anytime.</p>
      )}
    </form>
  )
}
