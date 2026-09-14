import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check, Minus } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      // `indeterminate` is filled exactly like `checked`: it is a real selection
      // state ("some of these rows"), not an empty box, and a master checkbox
      // that looks unchecked while rows are selected reads as a bug.
      "peer border-primary ring-offset-background focus-visible:ring-ring data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground h-4 w-4 shrink-0 rounded-sm border focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {/* Radix renders the Indicator for BOTH checked and indeterminate, so the
        glyph has to distinguish them - a tick for "all", a dash for "some".
        Without this an indeterminate master checkbox claimed every row was
        selected. */}
    <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
      {props.checked === "indeterminate" ? (
        <Minus className="h-4 w-4" />
      ) : (
        <Check className="h-4 w-4" />
      )}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

/**
 * Purely visual checkbox for rows that are themselves the click target.
 *
 * Radix's Checkbox renders a <button> plus, inside a <form>, a hidden bubble
 * <input>. Nesting that in a clickable row produces invalid <button><button>
 * markup AND an infinite update loop: on every checked change the bubble input
 * dispatches a BUBBLING synthetic click, which reaches the row's onClick and
 * toggles it straight back. Render this instead and put role="checkbox" +
 * aria-checked on the row.
 */
function CheckboxVisual({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      data-state={checked ? "checked" : "unchecked"}
      className={cn(
        "border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
        className,
      )}
    >
      {checked && <Check className="h-4 w-4" />}
    </span>
  )
}

export { Checkbox, CheckboxVisual }
