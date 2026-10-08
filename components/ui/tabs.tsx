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

/** The selected option: a solid surface, tinted text and a ring, visible in both themes. */
export const TAB_TRIGGER_ACTIVE =
  "bg-background text-primary ring-primary/30 font-semibold shadow-sm ring-1"

/** The same, as Radix state selectors. */
export const TAB_TRIGGER_ACTIVE_DATA =
  "data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:ring-primary/30 data-[state=active]:font-semibold data-[state=active]:shadow-sm data-[state=active]:ring-1"

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
