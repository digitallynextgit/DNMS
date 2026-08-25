import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "bg-muted text-muted-foreground inline-flex h-10 items-center justify-center rounded-[2px] p-1",
      // A 4-5 tab track is wider than a 390px phone. `main` clips horizontal
      // overflow, so without this the last tabs are simply unreachable there;
      // scrolling the track (bar hidden) keeps every tab tappable.
      "no-scrollbar max-w-full justify-start overflow-x-auto sm:justify-center",
      className,
    )}
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
    className={cn(
      // shrink-0 so triggers keep their size inside the scrolling track rather
      // than compressing into each other on a narrow screen.
      "ring-offset-background focus-visible:ring-ring inline-flex shrink-0 items-center justify-center rounded-[2px] px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
      // Active tab is clearly highlighted: a solid surface, primary-tinted text and
      // a ring so it stands out from the muted track in both light and dark themes.
      "data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:ring-primary/30 data-[state=active]:font-semibold data-[state=active]:shadow-sm data-[state=active]:ring-1",
      className,
    )}
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
