import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// THE tab look, defined once.
//
// Three components render a strip of one-of-N options - Radix Tabs (page
// sections), SegmentedControl (filter presets) and ViewToggle (card/table) -
// and they had each grown their own skin. A muted track with a raised active
// tab on one page, a bordered card track with a flat fill on the next, and the
// eye reads them as two different controls that happen to sit in the same app.
//
// So the classes live here and the other two import them. Anything that looks
// like a tab IS a tab, down to the ring on the active one. Height geometry is
// part of it: an h-9 track with p-1 leaves exactly h-7 for the options, which
// is why they carry a fixed height rather than vertical padding, and h-9 is the
// app's control height (Button, Input) so a strip lines up with whatever sits
// beside it in a toolbar.
// ─────────────────────────────────────────────────────────────────────────────

/** The track. */
export const TAB_TRACK =
  "bg-muted text-muted-foreground inline-flex h-9 items-center rounded-sm p-1 gap-0.5"

/**
 * The scroll behaviour, kept separate because ViewToggle (2-4 icons) never
 * needs it. A 4-5 tab track is wider than a 390px phone and `main` clips
 * horizontal overflow, so without this the last options are unreachable there.
 */
export const TAB_TRACK_SCROLL = "no-scrollbar max-w-full overflow-x-auto"

/**
 * One option, idle. shrink-0 so options keep their size inside the scrolling
 * track rather than compressing into each other on a narrow screen. gap-1.5 and
 * the icon size live here, not at the call sites, the way Button does it.
 */
export const TAB_TRIGGER =
  "ring-offset-background focus-visible:ring-ring inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-sm px-3 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0"

/**
 * The selected option: a solid surface, primary-tinted text and a ring, so it
 * stands off the muted track in both themes.
 *
 * For Radix, which drives selection off a data attribute; the plain-button
 * strips apply TAB_TRIGGER_ACTIVE conditionally instead.
 */
export const TAB_TRIGGER_ACTIVE =
  "bg-background text-primary ring-primary/30 font-semibold shadow-sm ring-1"

/** The same, as Radix state selectors. */
export const TAB_TRIGGER_ACTIVE_DATA =
  "data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:ring-primary/30 data-[state=active]:font-semibold data-[state=active]:shadow-sm data-[state=active]:ring-1"

/** Hover for an idle option. */
export const TAB_TRIGGER_IDLE = "hover:text-foreground"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(TAB_TRACK, TAB_TRACK_SCROLL, "justify-start", className)}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(TAB_TRIGGER, TAB_TRIGGER_IDLE, TAB_TRIGGER_ACTIVE_DATA, className)}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "ring-offset-background focus-visible:ring-ring mt-2 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
      className,
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
