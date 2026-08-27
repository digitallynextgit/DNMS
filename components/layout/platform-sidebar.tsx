"use client"

import Image from "next/image"
import Link from "next/link"
import { Building2, ArrowLeft } from "lucide-react"

import { cn } from "@/lib/utils"
import { useSidebarStore } from "@/stores/sidebar-store"
import { useAppPathname } from "@/components/tenant-link"
import { FOUNDING_TENANT_SLUG } from "@/lib/tenant-url"

/**
 * Sidebar for the platform console.
 *
 * A SEPARATE component from the dashboard sidebar on purpose. That one is built
 * from the signed-in tenant's permissions - Employees, Payroll, Projects - and
 * every item in it means "in this company". Rendering it beside a page that
 * lists every company invited exactly the misreading you would expect: does
 * "Employees" mean this workspace, or all of them?
 *
 * So the console gets its own nav, listing only what the console can actually
 * do, plus one route back into the operator's own workspace.
 *
 * ── ADDING TO THIS ───────────────────────────────────────────────────────────
 * Only add an item once the page behind it exists. A greyed-out "Billing" that
 * goes nowhere teaches people the nav is unreliable, and they stop reading it.
 */

const PLATFORM_ITEMS = [{ href: "/platform", label: "Companies", icon: Building2 }]

export function PlatformSidebar() {
  const { isCollapsed } = useSidebarStore()
  // Tenant-stripped, so the comparison works on both halves of the render.
  const pathname = useAppPathname()

  return (
    <aside
      className={cn(
        "bg-background border-border flex h-full min-h-0 shrink-0 flex-col border-r transition-all duration-200",
        isCollapsed ? "w-14" : "w-56",
      )}
    >
      <div
        className={cn(
          "border-border flex h-14.25 shrink-0 items-center overflow-hidden border-b",
          isCollapsed ? "justify-center px-2" : "px-4",
        )}
      >
        <div className={cn("flex items-center overflow-hidden", isCollapsed ? "w-9" : "w-auto")}>
          <Image
            src="/logo_white_bg.png"
            alt="Digitally Next"
            width={370}
            height={96}
            className="h-10 w-auto max-w-none dark:hidden"
          />
          <Image
            src="/logo_dark_bg.webp"
            alt="Digitally Next"
            width={370}
            height={96}
            className="hidden h-10 w-auto max-w-none dark:block"
          />
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {!isCollapsed && (
          <p className="text-muted-foreground px-2.5 pb-1 text-[10px] font-medium tracking-widest uppercase">
            Platform
          </p>
        )}
        {PLATFORM_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              title={isCollapsed ? label : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-sm transition-colors",
                isCollapsed && "justify-center px-0",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/5",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* The way back. Platform staff are employees of Digitally Next too, and
          without this the console is a room with no door. */}
      <div className="border-border shrink-0 border-t p-2">
        <Link
          href={`/${FOUNDING_TENANT_SLUG}/dashboard`}
          title={isCollapsed ? "Back to my workspace" : undefined}
          className={cn(
            "text-muted-foreground hover:text-foreground hover:bg-foreground/5 flex items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-sm transition-colors",
            isCollapsed && "justify-center px-0",
          )}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span>My workspace</span>}
        </Link>
      </div>
    </aside>
  )
}
