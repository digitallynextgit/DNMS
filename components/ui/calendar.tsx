"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "relative flex flex-col gap-4 sm:flex-row",
        month: "flex w-full flex-col gap-4",
        // Caption row holds the month/year dropdowns; the horizontal padding
        // keeps them clear of the absolutely-positioned nav arrows.
        month_caption: "flex h-8 items-center justify-center px-8",
        caption_label: "text-sm font-medium",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "size-8 bg-transparent p-0 opacity-70 hover:opacity-100",
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "size-8 bg-transparent p-0 opacity-70 hover:opacity-100",
        ),
        dropdowns: "flex items-center justify-center gap-1.5",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground w-8 rounded text-[0.8rem] font-normal",
        week: "mt-2 flex w-full",
        day: "relative size-8 p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 rounded p-0 font-normal aria-selected:opacity-100",
        ),
        range_end: "day-range-end",
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary [&>button:hover]:text-primary-foreground rounded",
        today: "[&>button]:bg-accent [&>button]:text-accent-foreground rounded",
        outside: "text-muted-foreground/50",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName }) => {
          const Icon =
            orientation === "left"
              ? ChevronLeft
              : orientation === "right"
                ? ChevronRight
                : ChevronDown
          return <Icon className={cn("size-4", chevronClassName)} />
        },
        // Render the month/year dropdowns with the app's own Select so they
        // match the rest of the form and stay readable in every theme. rdp only
        // reads `e.target.value`, so a synthetic event is enough to drive it.
        Dropdown: ({ options, value, onChange }) => (
          <Select
            value={value?.toString()}
            onValueChange={(v) =>
              onChange?.({
                target: { value: v },
              } as unknown as React.ChangeEvent<HTMLSelectElement>)
            }
          >
            <SelectTrigger className="h-8 w-fit gap-1 px-2 text-sm font-medium focus:ring-0 focus:ring-offset-0">
              <SelectValue />
            </SelectTrigger>
            {/* z-70 lifts the month/year list above the calendar's own popover
                (z-60); without it the dropdown opens *behind* the calendar. */}
            <SelectContent className="z-70 max-h-72">
              {options?.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value.toString()}
                  disabled={option.disabled}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
      }}
      {...props}
    />
  )
}

export { Calendar }
