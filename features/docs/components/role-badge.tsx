import { cn } from "@/lib/utils"

type Role = "employee" | "manager" | "hr" | "admin"

interface RoleBadgeProps {
  role: Role
}

const roleConfig: Record<Role, { label: string; className: string }> = {
  employee: {
    label: "Employee",
    className: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  },
  manager: {
    label: "Manager",
    className: "bg-purple-500/10 text-purple-500 border-purple-500/30",
  },
  hr: {
    label: "HR",
    className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  },
  admin: {
    label: "Admin",
    className: "bg-destructive/10 text-destructive border-destructive/30",
  },
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const config = roleConfig[role]
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.className,
      )}
    >
      {config.label}
    </span>
  )
}
