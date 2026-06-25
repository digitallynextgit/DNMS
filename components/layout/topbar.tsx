"use client"

import { Session } from "next-auth"
import { signOut } from "next-auth/react"
import { useTheme } from "next-themes"
import { Bell, LogOut, User, ChevronDown, PanelLeft, PanelLeftClose } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { useSidebarStore } from "@/stores/sidebar-store"
import { useThemeStore } from "@/stores/theme-store"
import { useEmployee } from "@/features/employees"
import { ThemePicker } from "./theme-picker"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"

async function fetchUnreadCount() {
  const res = await fetch("/api/notifications/inbox?unread=true&limit=1")
  if (!res.ok) return 0
  const data = await res.json()
  return data.unreadCount ?? 0
}

export function Topbar({ session }: { session: Session }) {
  const { id, firstName, lastName, email, profilePhoto: sessionPhoto } = session.user
  // Live photo: shares the same ["employee", id] cache as the profile page, so a
  // photo upload/removal (which invalidates ["employee"]) refreshes the avatar
  // here too — without waiting for the session JWT to be reissued at next login.
  // Fall back to the session value until the live query resolves to avoid a flash.
  const { data: liveEmployee } = useEmployee(id)
  const profilePhoto = liveEmployee ? (liveEmployee.data?.profilePhoto ?? null) : sessionPhoto
  const { isCollapsed, toggle } = useSidebarStore()
  const clearPalette = useThemeStore((s) => s.clearPalette)
  const { setTheme } = useTheme()

  // On logout, drop any custom palette and fall back to the default (system)
  // theme so the next user / the login page starts from the default colors.
  function handleSignOut() {
    clearPalette()
    setTheme("system")
    signOut({ callbackUrl: "/login" })
  }

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: fetchUnreadCount,
    refetchInterval: 30_000,
  })

  return (
    <header className="bg-background border-border flex h-14.25 shrink-0 items-center justify-between border-b px-4">
      <div className="flex flex-1 items-center">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggle}
                className="text-muted-foreground hover:text-foreground h-8 w-8"
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
              <span className="border-border/60 text-muted-foreground ml-1.5 rounded border px-1 py-px text-[10px]">
                Ctrl B
              </span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-center gap-1">
        <ThemePicker />

        {/* Notifications */}
        <Link href="/notifications">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground relative h-8 w-8"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-1.5 w-1.5">
                <span className="bg-foreground absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" />
                <span className="bg-foreground relative inline-flex h-1.5 w-1.5 rounded-full" />
              </span>
            )}
          </Button>
        </Link>

        <div className="bg-border mx-1 h-4 w-px" />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="hover:bg-accent focus-visible:ring-ring flex items-center gap-2 rounded px-2 py-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none">
              <AvatarDisplay
                src={profilePhoto}
                firstName={firstName}
                lastName={lastName}
                size="xs"
                fallbackClassName="bg-foreground text-background"
                className="h-6 w-6"
              />
              <span className="hidden text-sm font-medium md:block">
                {firstName} {lastName}
              </span>
              <ChevronDown className="text-muted-foreground hidden h-3 w-3 md:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="py-2 font-normal">
              <div className="flex items-center gap-2.5">
                <AvatarDisplay
                  src={profilePhoto}
                  firstName={firstName}
                  lastName={lastName}
                  size="xs"
                  fallbackClassName="bg-foreground text-background"
                  className="h-7 w-7"
                />
                <div>
                  <p className="text-sm leading-tight font-medium">
                    {firstName} {lastName}
                  </p>
                  <p className="text-muted-foreground max-w-37.5 truncate text-xs">{email}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile" className="cursor-pointer gap-2 text-sm">
                <User className="h-3.5 w-3.5" /> My Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer gap-2 text-sm"
              onClick={handleSignOut}
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
