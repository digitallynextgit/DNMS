import { db } from "@/server/db"

type NotificationType = "info" | "success" | "warning" | "error"

interface CreateNotificationOptions {
  employeeId: string
  title: string
  message: string
  type?: NotificationType
  link?: string
}

/**
 * Creates a single in-app notification for an employee.
 * Always non-blocking - errors are swallowed so the caller's main operation
 * is never disrupted by a notification failure.
 */
export async function createNotification(opts: CreateNotificationOptions): Promise<void> {
  try {
    await db.notification.create({
      data: {
        employeeId: opts.employeeId,
        title: opts.title,
        message: opts.message,
        type: opts.type ?? "info",
        link: opts.link ?? null,
      },
    })
  } catch (err) {
    console.error("[createNotification] failed:", err)
  }
}

/**
 * Notifies the people who can act on a request (leave / WFH) the moment it is
 * submitted: the requester's direct manager plus all active HR approvers
 * (hr_manager / admin roles). Non-blocking, deduped, excludes the requester.
 */
export async function notifyApprovers(opts: {
  requesterId: string
  title: string
  message: string
  link?: string
}): Promise<void> {
  try {
    const [requester, hrApprovers] = await Promise.all([
      db.employee.findUnique({
        where: { id: opts.requesterId },
        select: { managerId: true },
      }),
      db.employee.findMany({
        where: {
          isActive: true,
          employeeRoles: { some: { role: { name: { in: ["hr_manager", "admin"] } } } },
        },
        select: { id: true },
      }),
    ])

    const recipientIds = new Set<string>()
    if (requester?.managerId) recipientIds.add(requester.managerId)
    for (const a of hrApprovers) recipientIds.add(a.id)
    recipientIds.delete(opts.requesterId)

    for (const employeeId of recipientIds) {
      await createNotification({
        employeeId,
        title: opts.title,
        message: opts.message,
        type: "info",
        link: opts.link,
      })
    }
  } catch (err) {
    console.error("[notifyApprovers] failed:", err)
  }
}

/**
 * Creates in-app notifications for multiple employees at once.
 */
export async function createNotifications(
  notifications: CreateNotificationOptions[],
): Promise<void> {
  try {
    await db.notification.createMany({
      data: notifications.map((n) => ({
        employeeId: n.employeeId,
        title: n.title,
        message: n.message,
        type: n.type ?? "info",
        link: n.link ?? null,
      })),
    })
  } catch (err) {
    console.error("[createNotifications] failed:", err)
  }
}
