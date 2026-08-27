"use client"

import { Link, useAppPathname } from "@/components/tenant-link"
import { LayoutDashboard, Clock, ListChecks, MessageSquare, LayoutGrid } from "lucide-react"

import { cn } from "@/lib/utils"
import { useUnreadChatCount } from "@/hooks/use-unread-chat"

interface Tab {
  label: string
  href: string
  icon: React.ElementType
  /** Extra prefixes that should light this tab up. */
  match?: string[]
  badge?: "unread-chat"
}

/**
 * The five phone tabs. Everything else in the app is reachable from "More",
 * which mirrors the desktop sidebar's sections. The desktop sidebar cannot
 * work on a 390px screen (its rail alone eats 56px of a 390px viewport), so
 * below `md` this bar is the primary navigation.
 */
const TABS: Tab[] = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Attendance", href: "/attendance/me", icon: Clock },
  { label: "Tasks", href: "/projects/my-tasks", icon: ListChecks },
  { label: "Chat", href: "/chat", icon: MessageSquare, badge: "unread-chat" },
  { label: "More", href: "/more", icon: LayoutGrid },
]

function ChatBadge() {
  const { data: count = 0 } = useUnreadChatCount()
  if (count <= 0) return null
  return (
    <span className="bg-destructive absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-[2px] px-1 text-[9px] leading-none font-semibold text-white">
      {count > 99 ? "99+" : count}
    </span>
  )
}

export function MobileTabbar() {
  // NOT usePathname(): that returns the tenant-prefixed URL on the client and
  // the rewritten one on the server, so nav highlighting broke on hydration.
  const pathname = useAppPathname()

  function isActive(tab: Tab): boolean {
    if (pathname === tab.href) return true
    if (pathname.startsWith(tab.href + "/")) return true
    return (tab.match ?? []).some((m) => pathname === m || pathname.startsWith(m + "/"))
  }

  return (
    <nav
      aria-label="Primary"
      // pb keeps the row clear of the iOS home indicator / gesture bar.
      className="border-border bg-background flex shrink-0 items-stretch border-t px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
    >
      {TABS.map((tab) => {
        const active = isActive(tab)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 rounded-[2px] py-1.5 transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="relative">
              <tab.icon className="h-5.5 w-5.5" strokeWidth={active ? 2.25 : 2} />
              {tab.badge === "unread-chat" && <ChatBadge />}
            </span>
            <span
              className={cn("text-[10px] leading-none", active ? "font-semibold" : "font-medium")}
            >
              {tab.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
