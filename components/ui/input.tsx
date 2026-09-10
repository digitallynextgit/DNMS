import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // h-9 + rounded-sm so an Input sits exactly flush with a default
          // Button next to it (see components/ui/button.tsx).
          //
          // py-1, NOT py-2. Boxes here are border-box, so h-9 (36px) minus the
          // 2px border minus py-2 (16px) left an 18px content box for a 20px
          // line - the text was clipped top and bottom, which ate descenders
          // and the spell-check underline. The HEIGHT is unchanged, so nothing
          // shifts anywhere; the line simply has room to sit in now.
          "border-input bg-background ring-offset-background file:text-foreground placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-sm border px-3 py-1 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = "Input"

export { Input }
