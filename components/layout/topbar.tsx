"use client"

import { Session } from "next-auth"
import { signOut } from "next-auth/react"
import { useTheme } from "next-themes"
import {
  Bell,
  LogOut,
  User,
  ChevronDown,
  PanelLeft,
  PanelLeftClose,
  Sparkles,
  Building2,
} from "lucide-react"
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
import { unregisterPush } from "@/components/providers/realtime-notifications"
import { useSidebarStore } from "@/stores/sidebar-store"
import { useThemeStore } from "@/stores/theme-store"
import { useAiAssistantStore } from "@/stores/ai-assistant-store"
import { useEmployee } from "@/features/employees/hooks/use-employees"
import { useUnreadNotificationCount } from "@/hooks/use-unread-notifications"
import { cn } from "@/lib/utils"
import { FOUNDING_TENANT_ID } from "@/lib/tenant-url"
import { ThemePicker } from "./theme-picker"
import { Link } from "@/components/tenant-link"
import Image from "next/image"

export function Topbar({ session }: { session: Session }) {
  const { id, firstName, lastName, email, profilePhoto: sessionPhoto } = session.user

  // Cosmetic only (mirrors isPlatformAdmin in server/platform-admin.ts); /platform re-checks
  // server-side. The env-list half isn't mirrored - those users reach the console by URL.
  const isPlatformStaff =
    session.user.kind !== "client" &&
    session.user.tenantId === FOUNDING_TENANT_ID &&
    (session.user.roles ?? []).includes("admin_")
  // Shares the ["employee", id] cache with the profile page, so a photo change shows here at once.
  const { data: liveEmployee } = useEmployee(id)
  const profilePhoto = liveEmployee ? (liveEmployee.data?.profilePhoto ?? null) : sessionPhoto
  const { isCollapsed, toggle } = useSidebarStore()
  const clearPalette = useThemeStore((s) => s.clearPalette)
  const { setTheme } = useTheme()

  // Reset to the default theme so the next user and the login page don't inherit this palette.
  async function handleSignOut() {
    clearPalette()
    setTheme("system")
    await unregisterPush()
    signOut({ callbackUrl: "/login" })
  }

  const { data: unreadCount = 0 } = useUnreadNotificationCount()

  // The panel is rendered by the dashboard layout; this only toggles it.
  const aiOpen = useAiAssistantStore((s) => s.open)
  const toggleAi = useAiAssistantStore((s) => s.toggle)

  return (
    <header className="bg-background border-border flex h-14.25 shrink-0 items-center justify-between border-b px-4">
      <div className="flex min-w-0 flex-1 items-center">
        {/* Phones have no sidebar, so show the wordmark instead of the toggle. */}
        <Link href="/dashboard" aria-label="DNMS" className="flex items-center md:hidden">
          <Image
            src="/logo_white_bg-96.png"
            alt="Digitally Next"
            width={370}
            height={96}
            className="h-8 w-auto max-w-none dark:hidden"
          />
          <Image
            src="/logo_dark_bg-96.webp"
            alt="Digitally Next"
            width={370}
            height={96}
            className="hidden h-8 w-auto max-w-none dark:block"
          />
        </Link>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggle}
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
              <span className="border-border/60 text-muted-foreground ml-1.5 rounded-sm border px-1 py-px text-[10px]">
                Ctrl B
              </span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleAi}
          title="Ask DNMS"
          aria-label="Ask DNMS"
          aria-pressed={aiOpen}
          className={cn(
            // 40px tap target on phones, 32px from md up.
            "text-muted-foreground hover:text-foreground",
            aiOpen && "bg-muted text-foreground",
          )}
        >
          <Sparkles className="h-4 w-4" />
        </Button>

        <ThemePicker />

        {/* asChild: <Link><Button> would render invalid <a><button>. */}
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="text-muted-foreground hover:text-foreground relative"
        >
          <Link href="/notifications" aria-label="Notifications">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="bg-destructive absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-sm px-1 text-[9px] leading-none font-semibold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
        </Button>

        <div className="bg-border mx-1 h-4 w-px" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="hover:bg-accent focus-visible:ring-ring flex items-center gap-2 rounded-sm px-2 py-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none">
              <AvatarDisplay
                src={profilePhoto}
                firstName={firstName}
                lastName={lastName}
                size="chip"
                fallbackClassName="bg-foreground text-background"
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
                  size="chip"
                  fallbackClassName="bg-foreground text-background"
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
            {isPlatformStaff && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  {/* Not tenant-prefixed: the console spans every company ("platform" is in GLOBAL_SEGMENTS). */}
                  <Link href="/platform" className="cursor-pointer gap-2 text-sm">
                    <Building2 className="h-3.5 w-3.5" /> DNMS Platform
                  </Link>
                </DropdownMenuItem>
              </>
            )}
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
