import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

// The one tab look, shared by Radix Tabs, SegmentedControl and ViewToggle. An h-9 track with p-1
// leaves h-7 for the options, matching the app's control height.

export const TAB_TRACK =
  "bg-muted text-muted-foreground inline-flex h-9 items-center rounded-sm p-1 gap-0.5"

/** Separate because ViewToggle never needs it; without it the last tabs are unreachable on phones. */
export const TAB_TRACK_SCROLL = "no-scrollbar max-w-full overflow-x-auto"

/** shrink-0 so options keep their size in the scrolling track. */
export const TAB_TRIGGER =
  "ring-offset-background focus-visible:ring-ring inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-sm px-3 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0"

/** The selected option: a solid primary pill, so it can't be mistaken for its neighbours. */
export const TAB_TRIGGER_ACTIVE = "bg-primary text-primary-foreground font-semibold shadow-sm"

/** The same, as Radix state selectors. */
export const TAB_TRIGGER_ACTIVE_DATA =
  "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-semibold data-[state=active]:shadow-sm"

export const TAB_TRIGGER_IDLE = "text-foreground/75 hover:text-foreground hover:bg-background/70"

/**
 * Tabs nested inside a page's own tabs: an underlined row instead of a filled track, so the two
 * levels never look alike.
 */
const UNDERLINE_LIST =
  "border-border flex h-auto w-full items-end gap-1 rounded-none border-b bg-transparent p-0"
const UNDERLINE_TRIGGER =
  "ring-offset-background focus-visible:ring-ring text-muted-foreground hover:text-foreground -mb-px inline-flex h-9 shrink-0 items-center justify-center gap-1.5 border-b-2 border-transparent px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:font-semibold [&_svg]:size-4 [&_svg]:shrink-0"

export type TabsVariant = "pill" | "underline"

const TabsVariantContext = React.createContext<TabsVariant>("pill")

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { variant?: TabsVariant }
>(({ className, variant = "pill", ...props }, ref) => (
  <TabsVariantContext.Provider value={variant}>
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        variant === "underline" ? UNDERLINE_LIST : TAB_TRACK,
        TAB_TRACK_SCROLL,
        "justify-start",
        className,
      )}
      {...props}
    />
  </TabsVariantContext.Provider>
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(TabsVariantContext)
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        variant === "underline"
          ? UNDERLINE_TRIGGER
          : [TAB_TRIGGER, TAB_TRIGGER_IDLE, TAB_TRIGGER_ACTIVE_DATA],
        className,
      )}
      {...props}
    />
  )
})
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
