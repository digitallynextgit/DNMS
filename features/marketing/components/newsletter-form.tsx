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
      <div className="sm:border-border sm:bg-card sm:focus-within:border-primary/50 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 sm:rounded-[6px] sm:border sm:p-1.5 sm:shadow-sm sm:transition-colors">
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
          className="border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-primary/50 min-w-0 flex-1 rounded-[6px] border px-3 py-2.5 text-sm shadow-sm outline-none sm:border-0 sm:bg-transparent sm:py-1.5 sm:shadow-none"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="bg-primary text-primary-foreground inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-[6px] px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto sm:py-1.5"
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
