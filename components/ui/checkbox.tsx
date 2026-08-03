import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer border-primary ring-offset-background focus-visible:ring-ring data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground h-4 w-4 shrink-0 rounded-[2px] border focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
      <Check className="h-4 w-4" />
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
        "border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex h-4 w-4 shrink-0 items-center justify-center rounded-[2px] border",
        className,
      )}
    >
      {checked && <Check className="h-4 w-4" />}
    </span>
  )
}

export { Checkbox, CheckboxVisual }
