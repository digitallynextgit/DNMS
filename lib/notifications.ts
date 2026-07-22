import { db } from "@/server/db"
import { getSession } from "@/server/api-handler"
import { isAdmin_Session } from "@/lib/audit"
import { sendPushToEmployee } from "@/lib/web-push"

type NotificationType = "info" | "success" | "warning" | "error"

// Admin_ is a silent watch account: actions it performs must not generate
// notifications. Checks the current request's session - a null session (e.g. a
// cron run with no logged-in user) is NOT admin_, so those proceed normally.
async function suppressedForAdmin_(): Promise<boolean> {
  try {
    return isAdmin_Session(await getSession())
  } catch {
    return false
  }
}

interface CreateNotificationOptions {
  employeeId: string
  title: string
  message: string
  type?: NotificationType
  link?: string
}

// A direct, intentional ping (an @mention or a thread reply) must reach its
// recipient even when the actor is the silent admin_ account - the admin_
// suppression only exists to mute the CEO's routine/administrative side-effects.
interface NotifyControl {
  force?: boolean
}

/**
 * Creates a single in-app notification for an employee.
 * Always non-blocking - errors are swallowed so the caller's main operation
 * is never disrupted by a notification failure.
 */
export async function createNotification(
  opts: CreateNotificationOptions,
  control: NotifyControl = {},
): Promise<void> {
  if (!control.force && (await suppressedForAdmin_())) return
  try {
    const created = await db.notification.create({
      data: {
        employeeId: opts.employeeId,
        title: opts.title,
        message: opts.message,
        type: opts.type ?? "info",
        link: opts.link ?? null,
      },
      select: { id: true },
    })

    // Also push to the browser, so it lands even with every DNMS tab closed.
    // Fire-and-forget: push must never slow down or fail the caller.
    void sendPushToEmployee(opts.employeeId, {
      id: created.id,
      title: opts.title,
      message: opts.message,
      link: opts.link ?? null,
    }).catch((err) => console.error("[createNotification] push failed:", err))
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
  control: NotifyControl = {},
): Promise<void> {
  if (!control.force && (await suppressedForAdmin_())) return
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

    // Push each one too (fire-and-forget), so recipients get it with no tab open.
    for (const n of notifications) {
      void sendPushToEmployee(n.employeeId, {
        title: n.title,
        message: n.message,
        link: n.link ?? null,
      }).catch((err) => console.error("[createNotifications] push failed:", err))
    }
  } catch (err) {
    console.error("[createNotifications] failed:", err)
  }
}
