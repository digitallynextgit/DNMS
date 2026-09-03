"use client"

import { Link } from "@/components/tenant-link"
import { signOut } from "next-auth/react"
import { Session } from "next-auth"
import { useTheme } from "next-themes"
import { ChevronRight, LogOut, User } from "lucide-react"

import { cn } from "@/lib/utils"
import { PERMISSIONS } from "@/lib/constants"
import {
  EMPLOYEE_ITEMS,
  COMPANY_ITEMS,
  HRMS_ITEMS,
  ADMIN_ITEMS,
  projectItems,
  canAccess,
  isItemVisible,
  type NavItem,
  type NavChild,
} from "@/config/nav"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { StatusBadge } from "@/components/shared/status-badge"
import { EMPLOYEE_STATUS_COLORS, EMPLOYEE_STATUS_LABELS } from "@/lib/constants"
import { Badge } from "@/components/ui/badge"
import { useEmployee } from "@/features/employees/hooks/use-employees"
import { usePendingResignationCount } from "@/features/resignations"
import { useUnreadNotificationCount } from "@/hooks/use-unread-notifications"
import { useUnreadChatCount } from "@/hooks/use-unread-chat"
import { useThemeStore } from "@/stores/theme-store"

function Count({ badge }: { badge: NonNullable<NavItem["badge"]> }) {
  const { data: resignations = 0 } = usePendingResignationCount()
  const { data: notifications = 0 } = useUnreadNotificationCount()
  const { data: chat = 0 } = useUnreadChatCount()
  const count =
    badge === "pending-resignations" ? resignations : badge === "unread-chat" ? chat : notifications
  if (count <= 0) return null
  return (
    <span className="bg-destructive flex h-5 min-w-5 items-center justify-center rounded-sm px-1.5 text-[11px] leading-none font-semibold text-white">
      {count > 99 ? "99+" : count}
    </span>
  )
}

function Row({
  href,
  icon: Icon,
  label,
  badge,
  last,
}: {
  href: string
  icon?: React.ElementType
  label: string
  badge?: NavItem["badge"]
  last: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "hover:bg-accent flex min-h-11 items-center gap-3 px-4 py-2.5 transition-colors",
        !last && "border-border border-b",
      )}
    >
      {Icon ? (
        <Icon className="text-muted-foreground h-4.5 w-4.5 shrink-0" />
      ) : (
        <span className="w-4.5 shrink-0" />
      )}
      <span className="flex-1 truncate text-sm">{label}</span>
      {badge && <Count badge={badge} />}
      <ChevronRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
    </Link>
  )
}

/** One titled card of links; renders nothing when the user can see none. */
function Group({
  title,
  items,
  permissions,
  roles,
}: {
  title: string
  items: NavItem[]
  permissions: string[]
  roles: string[]
}) {
  // Flatten groups: a phone menu is a list, so a parent with children becomes
  // its children (prefixed by the parent) rather than an accordion.
  const rows: {
    href: string
    label: string
    icon?: React.ElementType
    badge?: NavItem["badge"]
  }[] = []
  for (const item of items) {
    if (!isItemVisible(item, permissions, roles)) continue
    if (item.children) {
      const kids = item.children.filter((c: NavChild) => canAccess(c, permissions, roles))
      kids.forEach((c, i) =>
        rows.push({ href: c.href, label: c.label, icon: i === 0 ? item.icon : undefined }),
      )
    } else if (item.href) {
      rows.push({ href: item.href, label: item.label, icon: item.icon, badge: item.badge })
    }
  }
  if (rows.length === 0) return null

  return (
    <section className="space-y-2">
      <h2 className="text-muted-foreground px-1 text-[10px] font-medium tracking-widest uppercase">
        {title}
      </h2>
      <div className="border-border bg-card overflow-hidden rounded-sm border">
        {rows.map((r, i) => (
          <Row key={r.href} {...r} last={i === rows.length - 1} />
        ))}
      </div>
    </section>
  )
}

/**
 * The phone "More" screen: the whole sidebar, flattened into tappable lists and
 * gated by exactly the same permissions. Only rendered below `md` (the route
 * redirects on desktop, where the sidebar already covers this).
 */
export function MobileMoreMenu({ session }: { session: Session }) {
  const { id, firstName, lastName, email, profilePhoto: sessionPhoto } = session.user
  const permissions = session.user.permissions
  const roles = session.user.roles
  const isAdmin_ = roles.includes("admin_")

  const { data: liveEmployee } = useEmployee(id)
  const employee = liveEmployee?.data
  const profilePhoto = liveEmployee ? (employee?.profilePhoto ?? null) : sessionPhoto

  const clearPalette = useThemeStore((s) => s.clearPalette)
  const { setTheme } = useTheme()

  function handleSignOut() {
    clearPalette()
    setTheme("system")
    signOut({ callbackUrl: "/login" })
  }

  return (
    <div className="space-y-5 py-4">
      {/* Identity card - doubles as the link into the full profile. */}
      <Link
        href="/profile"
        className="border-border bg-card hover:bg-accent flex items-center gap-3.5 rounded-sm border p-4 transition-colors"
      >
        <AvatarDisplay
          src={profilePhoto}
          firstName={firstName}
          lastName={lastName}
          size="lg"
          fallbackClassName="bg-foreground text-background"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-base font-semibold">
            {firstName} {lastName}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {employee?.designation?.title ?? email}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {employee?.employeeNo && (
              <Badge variant="outline" className="font-mono text-[10px]">
                {employee.employeeNo}
              </Badge>
            )}
            {employee?.status && (
              <StatusBadge
                status={employee.status}
                colorMap={EMPLOYEE_STATUS_COLORS}
                labelMap={EMPLOYEE_STATUS_LABELS}
                size="xs"
              />
            )}
          </div>
        </div>
        <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
      </Link>

      {!isAdmin_ && (
        <Group title="Me" items={EMPLOYEE_ITEMS} permissions={permissions} roles={roles} />
      )}
      <Group
        title="Work"
        items={projectItems(permissions.includes(PERMISSIONS.PROJECT_WRITE))}
        permissions={permissions}
        roles={roles}
      />
      <Group title="HRMS" items={HRMS_ITEMS} permissions={permissions} roles={roles} />
      <Group title="Admin" items={ADMIN_ITEMS} permissions={permissions} roles={roles} />
      <Group title="Company" items={COMPANY_ITEMS} permissions={permissions} roles={roles} />

      <section className="space-y-2">
        <h2 className="text-muted-foreground px-1 text-[10px] font-medium tracking-widest uppercase">
          Account
        </h2>
        <div className="border-border bg-card overflow-hidden rounded-sm border">
          <Row href="/profile" icon={User} label="My Profile" last={false} />
          <button
            type="button"
            onClick={handleSignOut}
            className="hover:bg-accent text-destructive flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors"
          >
            <LogOut className="h-4.5 w-4.5 shrink-0" />
            <span className="flex-1 text-sm">Sign out</span>
          </button>
        </div>
      </section>
    </div>
  )
}
