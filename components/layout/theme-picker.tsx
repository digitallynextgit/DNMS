"use client"

import { memo, useEffect, useMemo, useState } from "react"
import { useTheme } from "next-themes"
import { Check, Palette, Search, Sun, Moon, Monitor, RotateCcw, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useThemeStore } from "@/stores/theme-store"
import {
  themes,
  themesByCategory,
  categoryLabels,
  type Theme,
  type ThemeCategory,
} from "@/lib/themes"

const CATEGORIES: ThemeCategory[] = ["purple", "blue", "black", "teal", "green", "red", "amber"]

// Memoized so selecting a theme only re-renders the two cards whose `selected`
// flips, not all 111. `onSelect` takes the id so a single stable callback can be
// shared across every card (keeping memo effective).
const ThemeCard = memo(function ThemeCard({
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
        // content-visibility lets the browser skip layout/paint for off-screen
        // cards; contain-intrinsic-size reserves their space so the scrollbar
        // stays correct. This is what keeps 107 cards cheap to mount.
        "group relative flex flex-col gap-2 rounded-md border p-3 text-left transition-shadow [contain-intrinsic-size:auto_8.5rem] [content-visibility:auto] hover:shadow-md focus-visible:ring-2 focus-visible:outline-none",
        selected
          ? "border-primary ring-primary/30 ring-2"
          : "border-border hover:border-foreground/30",
      )}
      aria-pressed={selected}
    >
      <div
        className="flex h-16 items-center justify-center overflow-hidden rounded border"
        style={{ backgroundColor: theme.swatchBg, borderColor: theme.swatchAccent }}
      >
        <div className="flex gap-1.5">
          <span
            className="h-6 w-6 rounded-full shadow-sm"
            style={{ backgroundColor: theme.swatchPrimary }}
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
        {selected && <Check className="text-primary h-3.5 w-3.5 shrink-0" />}
      </div>
    </button>
  )
})

export function ThemePicker() {
  const [open, setOpen] = useState(false)
  // The grid of 111 cards is heavy to mount; defer it until the open animation
  // has settled (and unmount it immediately on close) so the dialog
  // open/close transition stays smooth.
  const [showGrid, setShowGrid] = useState(false)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<ThemeCategory | "all">("all")
  const { theme, setTheme } = useTheme()
  const { paletteId, setPalette, clearPalette } = useThemeStore()

  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => setShowGrid(true), 160)
    return () => clearTimeout(id)
  }, [open])

  function handleOpenChange(next: boolean) {
    if (!next) setShowGrid(false) // drop the grid before the close animation
    setOpen(next)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const source = activeTab === "all" ? themes : themesByCategory[activeTab]
    if (!q) return source
    return source.filter((t) => t.name.toLowerCase().includes(q))
  }, [search, activeTab])

  return (
    <TooltipProvider delayDuration={300}>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground h-8 w-8"
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

        <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Palette className="h-4 w-4" /> Choose a theme
            </DialogTitle>
            <DialogDescription className="text-xs">
              {themes.length} curated palettes. Selecting one overrides the default dark/light
              colors.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-2 border-b px-6 py-3">
            <div className="relative min-w-50 flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search themes…"
                className="h-8 pl-8 text-sm"
              />
            </div>
            <div className="bg-muted flex items-center gap-0.5 rounded-md p-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={theme === "light" && !paletteId ? "secondary" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      clearPalette()
                      setTheme("light")
                    }}
                    aria-label="Light"
                  >
                    <Sun className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">Default Light</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={theme === "dark" && !paletteId ? "secondary" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      clearPalette()
                      setTheme("dark")
                    }}
                    aria-label="Dark"
                  >
                    <Moon className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">Default Dark</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={theme === "system" && !paletteId ? "secondary" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      clearPalette()
                      setTheme("system")
                    }}
                    aria-label="System"
                  >
                    <Monitor className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-xs">System</TooltipContent>
              </Tooltip>
            </div>
            {paletteId && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => clearPalette()}
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </Button>
            )}
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as ThemeCategory | "all")}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="border-b px-6 py-3">
              <TabsList className="h-9 w-full justify-start gap-1 overflow-x-auto">
                <TabsTrigger value="all" className="text-xs">
                  All ({themes.length})
                </TabsTrigger>
                {CATEGORIES.map((cat) => (
                  <TabsTrigger key={cat} value={cat} className="text-xs">
                    {categoryLabels[cat]} ({themesByCategory[cat].length})
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <TabsContent value={activeTab} className="mt-0 outline-none">
                {!showGrid ? (
                  <div className="flex h-64 items-center justify-center">
                    <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-muted-foreground py-12 text-center text-sm">
                    No themes match &ldquo;{search}&rdquo;.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {filtered.map((t) => (
                      <ThemeCard
                        key={t.id}
                        theme={t}
                        selected={paletteId === t.id}
                        onSelect={setPalette}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
