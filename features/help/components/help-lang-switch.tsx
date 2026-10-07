"use client"

import { cn } from "@/lib/utils"
import { useHelpLang } from "../hooks/use-help-lang"
import type { HelpLang } from "../types"

const OPTIONS: { value: HelpLang; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिंदी" },
]

/** English / हिंदी switch. The choice is remembered and applies to every guide. */
export function HelpLangSwitch({ className }: { className?: string }) {
  const [lang, setLang] = useHelpLang()
  return (
    <div
      role="radiogroup"
      aria-label="Guide language"
      className={cn("bg-muted inline-flex shrink-0 rounded-sm p-0.5", className)}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={lang === o.value}
          onClick={() => setLang(o.value)}
          className={cn(
            "rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
            lang === o.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
