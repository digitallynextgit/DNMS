import { db } from "@/server/db"
import { getSession } from "@/server/api-handler"
import { isAdmin_Session } from "@/lib/audit"
import { sendPushToEmployee, type PushPayload } from "@/lib/web-push"
import { sendMobilePushToEmployee } from "@/lib/push-mobile"

type NotificationType = "info" | "success" | "warning" | "error"

/**
 * One notification, every transport. Browsers get Web Push (VAPID, filtered by
 * registering origin); the DNMS app gets FCM/APNs off its device tokens, which
 * have no origin to filter on - see the banner in lib/push-mobile.ts.
 *
 * Fire-and-forget, and ONE place to add the next transport: both senders already
 * swallow their own failures, and these .catch()es are the second net, because a
 * rejected push must never cost the caller the notification row it just wrote.
 */
function fanOutPush(employeeId: string, payload: PushPayload): void {
  void sendPushToEmployee(employeeId, payload).catch((err) =>
    console.error("[notifications] web push failed:", err),
  )
  void sendMobilePushToEmployee(employeeId, payload).catch((err) =>
    console.error("[notifications] mobile push failed:", err),
  )
}

// admin_ is a silent account, so its actions don't notify. A null session (cron) is not admin_.
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

// Direct pings (@mentions, replies) still go out when the actor is admin_.
interface NotifyControl {
  force?: boolean
}

/** Never throws - a notification failure must not disrupt the caller. */
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

    // Also push (fire-and-forget), so it lands with every tab closed and with
    // the app in the background.
    fanOutPush(opts.employeeId, {
      id: created.id,
      title: opts.title,
      message: opts.message,
      link: opts.link ?? null,
    })
  } catch (err) {
    console.error("[createNotification] failed:", err)
  }
}

/** Notifies the requester's manager and all active HR approvers of a new leave/WFH request. */
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

    // One batched insert, instead of an INSERT plus a push lookup per approver.
    if (recipientIds.size > 0) {
      await createNotifications(
        [...recipientIds].map((employeeId) => ({
          employeeId,
          title: opts.title,
          message: opts.message,
          type: "info" as const,
          link: opts.link,
        })),
      )
    }
  } catch (err) {
    console.error("[notifyApprovers] failed:", err)
  }
}

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

    for (const n of notifications) {
      // No id: createMany does not return the rows it wrote, so these pushes
      // carry no Notification id for the client to mark read. Unchanged.
      fanOutPush(n.employeeId, {
        title: n.title,
        message: n.message,
        link: n.link ?? null,
      })
    }
  } catch (err) {
    console.error("[createNotifications] failed:", err)
  }
}
