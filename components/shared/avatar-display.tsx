import { cn } from "@/lib/utils"
import { getInitials, getAvatarColor } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface AvatarDisplayProps {
  src?: string | null
  firstName: string
  lastName: string
  size?: "2xs" | "xs" | "chip" | "sm" | "md" | "lg" | "xl" | "2xl"
  /** Override the default hashed color + white-text fallback (e.g. "bg-primary/10 text-primary"). */
  fallbackClassName?: string
  className?: string
}

/**
 * Each step pairs a box with the font size that fits inside it. Reach for a
 * token rather than overriding the box with `className="h-6 w-6"` - that
 * changes the container without changing the text, which is how initials end up
 * crowding the border.
 */
const sizeClasses: Record<NonNullable<AvatarDisplayProps["size"]>, string> = {
  "2xs": "h-4 w-4 text-[8px]",
  xs: "h-5 w-5 text-[9px]",
  /** 24px - the topbar size, and the default for anything sitting in a card. */
  chip: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
  "2xl": "h-24 w-24 text-2xl",
}

export function AvatarDisplay({
  src,
  firstName,
  lastName,
  size = "md",
  fallbackClassName,
  className,
}: AvatarDisplayProps) {
  const initials = getInitials(firstName, lastName)
  const colorClass = getAvatarColor(firstName + lastName)

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {src && <AvatarImage src={src} alt={`${firstName} ${lastName}`} />}
      <AvatarFallback
        className={cn("font-semibold", fallbackClassName ?? cn("text-white", colorClass))}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}
