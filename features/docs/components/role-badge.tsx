import { StatusBadge } from "@/components/shared/status-badge"
import { DOC_ROLE_COLORS, DOC_ROLE_LABELS } from "@/lib/constants"

type Role = "employee" | "manager" | "hr" | "admin"

interface RoleBadgeProps {
  role: Role
}

export function RoleBadge({ role }: RoleBadgeProps) {
  return <StatusBadge status={role} colorMap={DOC_ROLE_COLORS} labelMap={DOC_ROLE_LABELS} />
}
