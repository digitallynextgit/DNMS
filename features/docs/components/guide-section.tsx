import * as React from "react"
import { cn } from "@/lib/utils"

interface GuideSectionProps {
  title: string
  children: React.ReactNode
  className?: string
}

export function GuideSection({ title, children, className }: GuideSectionProps) {
  return (
    <section className={cn("border-border border-b pb-8 last:border-0 last:pb-0", className)}>
      <h2 className="text-foreground mb-4 text-lg font-semibold">{title}</h2>
      <div className="text-foreground space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  )
}
