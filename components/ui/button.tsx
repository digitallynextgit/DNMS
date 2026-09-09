import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

// ── ONE BUTTON, ONE HEIGHT ──────────────────────────────────────────────────
// Every button in the app is 36px tall (h-9) with 14px text - the same height
// as an Input, a SelectTrigger, the TabsBar track and the SegmentedControl -
// so a row of controls always lines up, and two buttons on one page can never
// disagree.
//
// There is deliberately NO `sm` / `lg`. The moment a second height exists it
// ends up beside the first one: this app had seven heights (h-6 to h-11.5)
// and a Profile header at 32px over a 36px submit. `size` only decides the
// shape: `default` for text, `icon` for a lone glyph (a 36px square).
//
// Do NOT put h-*, py-*, size-*, min-h-* or text-* in `className`. If a button
// looks too big for its spot, the spot wants a chip (StatusBadge) or a plain
// link, not a smaller Button.
// ─────────────────────────────────────────────────────────────────────────────
const buttonVariants = cva(
  "focus-visible:ring-ring inline-flex h-9 items-center justify-center gap-2 rounded-sm px-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
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
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "",
        // Square. Same 36px, so it sits flush beside a text button.
        icon: "w-9 px-0",
      },
    },
    // A link is inline text, not a control: it takes the height of the line it
    // sits in. Declared here (after the variants) so it wins over the base h-9.
    compoundVariants: [{ variant: "link", class: "h-auto px-0" }],
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
