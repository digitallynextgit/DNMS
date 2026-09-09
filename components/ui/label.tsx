import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// `mb-2 block` gives every field label the same gap to its input as the login
// form. (In Tailwind v4, margin-bottom only applies to a block-level label, so
// `block` is required for `mb-2` to take effect.) Labels used inline / beside a
// checkbox or switch override this with `mb-0` on their own className.
const labelVariants = cva(
  "mb-2 block text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
)

/**
 * The one red asterisk for compulsory fields. `<Label required>` renders it;
 * reach for it directly only on a label that cannot be a `<Label>`.
 */
function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      {" "}
      *
    </span>
  )
}

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants> & {
      /** The field is compulsory: show the standard red asterisk after the text. */
      required?: boolean
    }
>(({ className, required, children, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props}>
    {children}
    {required && <RequiredMark />}
  </LabelPrimitive.Root>
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label, RequiredMark }
