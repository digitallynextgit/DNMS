"use client"

import { useState } from "react"
import { useTheme } from "next-themes"
import { Check, Palette, Sun, Moon, Monitor, RotateCcw } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useThemeStore } from "@/stores/theme-store"
import { themes, type Theme } from "@/lib/themes"

// Seven curated palettes - small enough that the picker needs no search, no
// category tabs and no deferred mounting. DialogContent pins the header/footer
// itself, so this stays a plain header + body + footer.

function ThemeCard({
  theme,
  selected,
  onSelect,
}: {
  theme: Theme
  selected: boolean
  onSelect: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(theme.id)}
      className={cn(
        "group relative flex flex-col gap-2 rounded border p-3 text-left transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:outline-none",
        selected
          ? "border-primary ring-primary/30 ring-2"
          : "border-border hover:border-foreground/30",
      )}
      aria-pressed={selected}
    >
      <div
        className="relative flex h-16 items-center justify-center overflow-hidden rounded border"
        style={{ backgroundColor: theme.swatchBg, borderColor: theme.swatchAccent }}
      >
        {/* A gradient theme can't be previewed by three flat dots - wash the
            swatch in its two hues so the card looks like what it applies. */}
        {theme.gradient && (
          <span
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(70% 90% at 12% 0%, ${theme.gradient.from}55, transparent 70%), radial-gradient(70% 90% at 92% 100%, ${theme.gradient.to}4d, transparent 70%)`,
            }}
          />
        )}
        <div className="relative flex gap-1.5">
          <span
            className="h-6 w-6 rounded-full shadow-sm"
            style={
              theme.gradient
                ? {
                    backgroundImage: `linear-gradient(135deg, ${theme.gradient.from}, ${theme.gradient.to})`,
                  }
                : { backgroundColor: theme.swatchPrimary }
            }
          />
          <span
            className="h-6 w-6 rounded-full shadow-sm"
            style={{ backgroundColor: theme.swatchAccent }}
          />
          <span
            className="h-6 w-6 rounded-full border border-white/20 shadow-sm"
            style={{ backgroundColor: theme.swatchBg }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium">{theme.name}</span>
        <span className="flex shrink-0 items-center gap-1">
          {theme.gradient && (
            <span className="text-muted-foreground text-[10px] tracking-wide uppercase">multi</span>
          )}
          {selected && <Check className="text-primary h-3.5 w-3.5" />}
        </span>
      </div>
    </button>
  )
}

export function ThemePicker() {
  const [open, setOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const { paletteId, setPalette, clearPalette } = useThemeStore()

  const modes = [
    { key: "light", label: "Default Light", icon: Sun },
    { key: "dark", label: "Default Dark", icon: Moon },
    { key: "system", label: "System", icon: Monitor },
  ] as const

  return (
    <TooltipProvider delayDuration={300}>
      <Dialog open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground"
                aria-label="Choose theme"
              >
                <Palette className="h-4 w-4" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Theme
          </TooltipContent>
        </Tooltip>

        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Palette className="h-4 w-4" /> Choose a theme
            </DialogTitle>
            <DialogDescription className="text-xs">
              One palette per colour. Selecting one overrides the default dark/light colors.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {themes.map((t) => (
              <ThemeCard key={t.id} theme={t} selected={paletteId === t.id} onSelect={setPalette} />
            ))}
          </div>

          <DialogFooter className="flex-row items-center justify-between sm:justify-between">
            <div className="bg-muted flex items-center gap-0.5 rounded p-0.5">
              {modes.map((m) => (
                <Tooltip key={m.key}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={theme === m.key && !paletteId ? "secondary" : "ghost"}
                      size="icon-sm"
                      onClick={() => {
                        clearPalette()
                        setTheme(m.key)
                      }}
                      aria-label={m.label}
                    >
                      <m.icon className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">{m.label}</TooltipContent>
                </Tooltip>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => clearPalette()}
              disabled={!paletteId}
            >
              <RotateCcw className="h-3 w-3" /> Reset to default
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
