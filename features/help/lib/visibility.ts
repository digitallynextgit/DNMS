import {
  ADMIN_ITEMS,
  COMPANY_ITEMS,
  EMPLOYEE_ITEMS,
  HRMS_ITEMS,
  canAccess,
  projectItems,
  type NavItem,
} from "@/lib/nav"
import type { HelpGuide, HelpSection } from "../types"

// A guide is visible to whoever can open its page: its href is looked up in the sidebar config.

/** Sidebar path → the permission that shows it (a child inherits its group's). */
const NAV_PERMISSION = (() => {
  const map = new Map<string, string | undefined>()
  const add = (items: NavItem[]) => {
    for (const item of items) {
      if (item.href) map.set(item.href, item.permission)
      for (const child of item.children ?? []) {
        map.set(child.href, child.permission ?? item.permission)
      }
    }
  }
  add(EMPLOYEE_ITEMS)
  add(COMPANY_ITEMS)
  add(projectItems(true))
  add(HRMS_ITEMS)
  add(ADMIN_ITEMS)
  return map
})()

export function guidePermission(guide: HelpGuide): string | undefined {
  if (guide.permission) return guide.permission
  return guide.href ? NAV_PERMISSION.get(guide.href) : undefined
}

export function canSeeGuide(guide: HelpGuide, permissions: string[], roles: string[]): boolean {
  return canAccess({ permission: guidePermission(guide) }, permissions, roles)
}

export function canSeeSection(
  section: HelpSection,
  permissions: string[],
  roles: string[],
): boolean {
  return canAccess({ permission: section.permission }, permissions, roles)
}
