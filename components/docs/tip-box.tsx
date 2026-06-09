import * as React from "react"
import { Lightbulb, AlertTriangle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

interface TipBoxProps {
  children: React.ReactNode
  variant?: "tip" | "warning" | "info"
}

const variantConfig = {
  tip: {
    bg: "bg-amber-500/10 border-amber-500/30",
    icon: Lightbulb,
    iconColor: "text-amber-500",
    textColor: "text-foreground",
  },
  warning: {
    bg: "bg-destructive/10 border-destructive/30",
    icon: AlertTriangle,
    iconColor: "text-destructive",
    textColor: "text-foreground",
  },
  info: {
    bg: "bg-blue-500/10 border-blue-500/30",
    icon: Info,
    iconColor: "text-blue-500",
    textColor: "text-foreground",
  },
}

export function TipBox({ children, variant = "tip" }: TipBoxProps) {
  const config = variantConfig[variant]
  const Icon = config.icon

  return (
    <div className={cn("flex items-start gap-3 rounded-[var(--radius)] border p-4", config.bg)}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", config.iconColor)} />
      <p className={cn("text-sm leading-relaxed", config.textColor)}>{children}</p>
    </div>
  )
}
