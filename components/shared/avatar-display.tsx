import { cn } from "@/lib/utils"
import { getInitials, getAvatarColor } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface AvatarDisplayProps {
  src?: string | null
  firstName: string
  lastName: string
  size?: "2xs" | "xs" | "chip" | "sm" | "md" | "lg" | "xl" | "2xl"
  /** Overrides the hashed-colour fallback, e.g. "bg-primary/10 text-primary". */
  fallbackClassName?: string
  className?: string
}

/** Each size pairs a box with a fitting font size - use these, not `className="h-6 w-6"`. */
const sizeClasses: Record<NonNullable<AvatarDisplayProps["size"]>, string> = {
  "2xs": "h-4 w-4 text-[8px]",
  xs: "h-5 w-5 text-[9px]",
  /** 24px, the default inside cards. */
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
