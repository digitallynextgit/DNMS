"use client"

import * as React from "react"
import { signOut } from "next-auth/react"
import { useTheme } from "next-themes"
import { LogOut, PanelLeft, PanelLeftClose, ChevronDown, User } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSidebarStore } from "@/stores/sidebar-store"
import { useThemeStore } from "@/stores/theme-store"
import { ThemePicker } from "@/components/layout/theme-picker"

/**
 * The portal's top bar. Same shell as the staff Topbar - same height, borders,
 * collapse toggle with its Ctrl+B hint, theme picker and account menu - minus
 * everything that is staff-only (notifications, the AI assistant, the employee
 * profile link), none of which a client account has.
 */
export function PortalTopbar({
  name,
  email,
  company,
}: {
  name: string
  email: string
  company: string | null
}) {
  const { isCollapsed, toggle } = useSidebarStore()
  const clearPalette = useThemeStore((s) => s.clearPalette)
  const { setTheme } = useTheme()

  // Match the staff behaviour: drop any custom palette on the way out so the
  // login page starts from the default theme.
  function handleSignOut() {
    clearPalette()
    setTheme("system")
    signOut({ callbackUrl: "/client-login" })
  }

  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "C"

  return (
    <header className="bg-background border-border flex h-14.25 shrink-0 items-center justify-between border-b px-4">
      <div className="flex flex-1 items-center">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggle}
                // No rail to collapse on a phone - the tab bar is the nav there.
                className="text-muted-foreground hover:text-foreground hidden md:inline-flex"
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isCollapsed ? (
                  <PanelLeft className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              <span className="border-border/60 text-muted-foreground ml-1.5 rounded-[2px] border px-1 py-px text-[10px]">
                Ctrl B
              </span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-center gap-1">
        <ThemePicker />
        <div className="bg-border mx-1 h-4 w-px" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 gap-2 px-2">
              <span className="bg-muted text-foreground flex h-6 w-6 items-center justify-center rounded-[2px] text-[11px] font-semibold">
                {initials}
              </span>
              <span className="hidden text-sm font-medium sm:inline">{name}</span>
              <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-0.5">
                <p className="text-sm font-medium">{name}</p>
                <p className="text-muted-foreground truncate text-xs">{email}</p>
                {company && <p className="text-muted-foreground truncate text-xs">{company}</p>}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="text-xs">
              <User className="mr-2 h-3.5 w-3.5" />
              Client account
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-xs">
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
