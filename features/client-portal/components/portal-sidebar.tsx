"use client"

import { useEffect } from "react"
import { Link, useAppPathname } from "@/components/tenant-link"
import Image from "next/image"
import {
  Package,
  Store,
  Boxes,
  ChevronDown,
  Mail,
  Activity,
  FolderOpen,
  CalendarRange,
  Table2,
} from "lucide-react"

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
  plan: CalendarRange,
  documents: FolderOpen,
  calendars: Table2,
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
 * The portal's left rail - the staff sidebar's shell, filled from the client's granted modules
 * so it can't offer a section they weren't given.
 */
export function PortalSidebar({
  projects,
  current,
}: {
  projects: PortalProject[]
  current: PortalProject
}) {
  const pathname = useAppPathname()
  const { isCollapsed, toggle } = useSidebarStore()
  const modules = CLIENT_MODULES.filter((m) => current.modules.includes(m.key))

  // Ctrl/Cmd+B toggles the sidebar. Copied from the staff sidebar rather than hoisted, so the two
  // never both register a listener.
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
        // Scoped to width - see components/layout/sidebar.tsx.
        "bg-background border-border flex h-full min-h-0 shrink-0 flex-col border-r transition-[width] duration-200 motion-reduce:transition-none",
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
            src="/logo_white_bg-96.png"
            alt="Digitally Next"
            width={370}
            height={96}
            className="h-10 w-auto max-w-none dark:hidden"
          />
          <Image
            src="/logo_dark_bg-96.webp"
            alt="Digitally Next"
            width={370}
            height={96}
            className="hidden h-10 w-auto max-w-none dark:block"
          />
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
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
                    "text-muted-foreground hover:text-foreground hover:bg-accent flex h-8 items-center gap-2.5 rounded-sm text-sm transition-colors",
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

            {isCollapsed ? (
              <div className="border-border mx-1 my-2 border-t" />
            ) : (
              <div aria-hidden className="h-2" />
            )}
          </>
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
                        "mx-auto flex h-8 w-8 items-center justify-center rounded-sm transition-colors",
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
                "flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-sm transition-colors",
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
