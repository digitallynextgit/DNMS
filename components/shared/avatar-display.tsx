import { cn } from "@/lib/utils"
import { getInitials, getAvatarColor } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface AvatarDisplayProps {
  src?: string | null
  firstName: string
  lastName: string
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}

const sizeClasses: Record<NonNullable<AvatarDisplayProps["size"]>, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
}

export function AvatarDisplay({
  src,
  firstName,
  lastName,
  size = "md",
  className,
}: AvatarDisplayProps) {
  const initials = getInitials(firstName, lastName)
  const colorClass = getAvatarColor(firstName + lastName)

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {src && <AvatarImage src={src} alt={`${firstName} ${lastName}`} />}
      <AvatarFallback className={cn("font-semibold text-white", colorClass)}>
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}
