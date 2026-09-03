"use client"

import * as React from "react"
import { Search, X } from "lucide-react"

import { cn } from "@/lib/utils"

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className,
}: SearchInputProps) {
  const [internalValue, setInternalValue] = React.useState(value)

  /**
   * The callback, held in a ref rather than read from the closure.
   *
   * Callers pass an inline arrow, so a NEW function identity arrives on every
   * render of the parent. In the debounce's dependencies that restarted the
   * timer on renders that had nothing to do with typing - and 300ms later fired
   * a "change" to the value that was already committed. Any handler doing more
   * than setState paid for it: the insights table reset itself to page 1 a beat
   * after you paged to 2, because its onChange also resets the page.
   */
  const onChangeRef = React.useRef(onChange)
  React.useEffect(() => {
    onChangeRef.current = onChange
  })

  React.useEffect(() => {
    setInternalValue(value)
  }, [value])

  React.useEffect(() => {
    // Already what the parent holds - nothing has been typed since the last
    // commit, so there is no change to announce. This is what makes a re-render
    // of the parent (or of this input) silent instead of an echo.
    if (internalValue === value) return
    const timer = setTimeout(() => onChangeRef.current(internalValue), 300)
    return () => clearTimeout(timer)
  }, [internalValue, value])

  const handleClear = () => {
    setInternalValue("")
    onChange("")
  }

  return (
    <div className={cn("relative", className)}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
      <input
        type="text"
        value={internalValue}
        onChange={(e) => setInternalValue(e.target.value)}
        placeholder={placeholder}
        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-sm border py-2 pr-9 pl-9 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      />
      {internalValue && (
        <button
          type="button"
          onClick={handleClear}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 transition-colors focus:outline-none"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
