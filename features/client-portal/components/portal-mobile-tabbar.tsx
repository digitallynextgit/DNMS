"use client"

import { Link, useAppPathname } from "@/components/tenant-link"
import { Package, Store, Boxes, Mail, Activity } from "lucide-react"

import { cn } from "@/lib/utils"
import { CLIENT_MODULES, type ClientModuleKey } from "../modules"

const ICONS: Record<ClientModuleKey, React.ComponentType<{ className?: string }>> = {
  products: Package,
  channels: Store,
  inventory: Boxes,
  mailer: Mail,
  activity: Activity,
}

/**
 * The portal's phone navigation: the client's granted modules as a bottom tab
 * bar, replacing the rail below `md` exactly as the staff shell does. The module
 * list is the same allowlist the sidebar reads, so a client can never reach a
 * module their grant does not include.
 */
export function PortalMobileTabbar({
  projectRef,
  modules,
}: {
  projectRef: string
  modules: ClientModuleKey[]
}) {
  // NOT usePathname(): that returns the tenant-prefixed URL on the client and
  // the rewritten one on the server, so nav highlighting broke on hydration.
  const pathname = useAppPathname()
  const items = CLIENT_MODULES.filter((m) => modules.includes(m.key))
  if (items.length === 0) return null

  return (
    <nav
      aria-label="Primary"
      className="border-border bg-background flex shrink-0 items-stretch border-t px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
    >
      {items.map((m) => {
        const href = `/portal/${projectRef}/${m.path}`
        const active = pathname === href || pathname.startsWith(href + "/")
        const Icon = ICONS[m.key]
        return (
          <Link
            key={m.key}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 rounded-[2px] py-1.5 transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-5.5 w-5.5" />
            <span
              className={cn(
                "text-center text-[10px] leading-tight",
                active ? "font-semibold" : "font-medium",
              )}
            >
              {/* "Product catalog" / "Email campaigns" are too long for a 78px
                  tab, so the bar uses the first word. */}
              {m.label.split(" ")[0]}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
