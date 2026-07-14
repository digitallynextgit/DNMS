import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { Spinner } from "@/components/shared/spinner"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "focus-visible:ring-ring inline-flex items-center justify-center gap-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Vercel primary: black bg/white text in light, white bg/black text in dark
        default:
          "bg-primary text-primary-foreground hover:bg-primary/85 active:bg-primary/75 shadow-sm",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
        outline:
          "border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground border shadow-sm",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        link: "text-foreground h-auto p-0 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 rounded px-4 py-2",
        sm: "h-8 rounded px-3 text-xs",
        lg: "h-10 rounded px-6",
        // Two sanctioned icon sizes - never override these with a className.
        // `icon`     - standalone icon button, pairs with a default (h-9) Button.
        // `icon-sm`  - compact row/toolbar action, pairs with a `sm` (h-8) Button.
        icon: "h-9 w-9 rounded",
        "icon-sm": "h-8 w-8 rounded [&_svg]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /**
   * Shows a leading spinner and disables the button. Use this instead of
   * hand-rolling `{isPending && <Spinner />}`.
   * Ignored when `asChild` is set (Slot must receive a single child).
   */
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, disabled, children, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={asChild ? undefined : disabled || loading}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
            {children}
          </>
        )}
      </Comp>
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
