"use client"

import { useEffect } from "react"
import { Link, useAppPathname } from "@/components/tenant-link"
import Image from "next/image"
import { Package, Store, Boxes, ChevronDown, Mail, Activity } from "lucide-react"

import { cn } from "@/lib/utils"
import { useSidebarStore } from "@/stores/sidebar-store"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CLIENT_MODULES, type ClientModuleKey } from "../modules"

const ICONS: Record<ClientModuleKey, React.ComponentType<{ className?: string }>> = {
  products: Package,
  channels: Store,
  inventory: Boxes,
  mailer: Mail,
  activity: Activity,
}

export interface PortalProject {
  projectRef: string
  projectName: string
  modules: ClientModuleKey[]
}

/**
 * The portal's left rail - deliberately the SAME shell as the staff sidebar
 * (components/layout/sidebar.tsx): identical widths, logo header, section
 * label, nav item sizing, collapsed rail with tooltips, and the shared
 * useSidebarStore so the collapse state and Ctrl+B behave the same way.
 *
 * What differs is what fills it. Staff nav comes from a static config filtered
 * by permission scopes; a client's comes from the modules on their grant, so the
 * rail literally cannot offer a section they were not given.
 */
export function PortalSidebar({
  projects,
  current,
}: {
  projects: PortalProject[]
  current: PortalProject
}) {
  // NOT usePathname(): that returns the tenant-prefixed URL on the client and
  // the rewritten one on the server, so nav highlighting broke on hydration.
  const pathname = useAppPathname()
  const { isCollapsed, toggle } = useSidebarStore()
  const modules = CLIENT_MODULES.filter((m) => current.modules.includes(m.key))

  // Ctrl+B (Windows/Linux) and Cmd+B (macOS) toggle the sidebar. The staff
  // sidebar binds this on ITS component, so the portal got the shortcut's
  // tooltip from the shared topbar but none of its behaviour - copied verbatim
  // rather than lifted, since hoisting it would mean both sidebars registering
  // a listener whenever they ever render together.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "b") {
        const target = e.target as HTMLElement | null
        const tag = target?.tagName
        const isEditable =
          tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable
        if (isEditable) return
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [toggle])

  return (
    <aside
      className={cn(
        "bg-background border-border flex h-full min-h-0 shrink-0 flex-col border-r transition-all duration-200",
        isCollapsed ? "w-14" : "w-56",
      )}
    >
      {/* Logo - same theme-aware wordmark pair the staff sidebar uses. */}
      <div
        className={cn(
          "border-border flex h-14.25 shrink-0 items-center overflow-hidden border-b",
          isCollapsed ? "justify-center px-2" : "px-4",
        )}
      >
        <div className={cn("flex items-center overflow-hidden", isCollapsed ? "w-9" : "w-auto")}>
          <Image
            src="/logo_white_bg-96.png"
            alt="Digitally Next"
            width={370}
            height={96}
            priority
            className="h-10 w-auto max-w-none dark:hidden"
          />
          <Image
            src="/logo_dark_bg-96.webp"
            alt="Digitally Next"
            width={370}
            height={96}
            priority
            className="hidden h-10 w-auto max-w-none dark:block"
          />
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {/* No project name for a single-project client: with nothing to switch
            between it was a static label eating the top of the rail. The
            switcher still appears for anyone holding more than one, where
            naming the current project is the whole point. */}
        {projects.length > 1 && (
          <>
            {!isCollapsed && (
              <p className="text-muted-foreground px-2.5 pb-1 text-[10px] font-medium tracking-widest uppercase">
                Project
              </p>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "text-muted-foreground hover:text-foreground hover:bg-accent flex h-8 items-center gap-2.5 rounded-[2px] text-sm transition-colors",
                    isCollapsed ? "mx-auto w-8 justify-center" : "w-full px-2.5",
                  )}
                >
                  <span className="truncate text-left">
                    {isCollapsed
                      ? current.projectName.slice(0, 2).toUpperCase()
                      : current.projectName}
                  </span>
                  {!isCollapsed && (
                    <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 opacity-50" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuLabel className="text-xs">Your projects</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {projects.map((p) => (
                  <DropdownMenuItem key={p.projectRef} asChild>
                    <Link href={`/portal/${p.projectRef}`} className="text-xs">
                      {p.projectName}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Separator between the switcher and the sections - only needed
                when the switcher is actually there. */}
            {isCollapsed ? (
              <div className="border-border mx-1 my-2 border-t" />
            ) : (
              <div aria-hidden className="h-2" />
            )}
          </>
        )}

        {!isCollapsed && (
          <p className="text-muted-foreground px-2.5 pb-1 text-[10px] font-medium tracking-widest uppercase">
            Store
          </p>
        )}

        {modules.map((m) => {
          const href = `/portal/${current.projectRef}/${m.path}`
          const isActive = pathname === href || pathname.startsWith(href + "/")
          const Icon = ICONS[m.key]

          if (isCollapsed) {
            return (
              <TooltipProvider key={m.key} delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={href}
                      className={cn(
                        "mx-auto flex h-8 w-8 items-center justify-center rounded-[2px] transition-colors",
                        isActive
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs font-medium">
                    {m.label}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          }

          return (
            <Link
              key={m.key}
              href={href}
              className={cn(
                "flex h-8 items-center gap-2.5 rounded-[2px] px-2.5 text-sm transition-colors",
                isActive
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{m.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
