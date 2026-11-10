import "server-only"

import { db } from "@/server/db"
import { addEmailAsJob, addEmailJob } from "@/lib/queue"
import { createNotification, createNotifications } from "@/lib/notifications"
import { renderOydFlagEmail } from "@/lib/email-layout"
import { SYSTEM_ROLES } from "@/lib/constants"
import { VISIBLE_EMPLOYEE_FILTER } from "@/server/selects"
import { getConfig, warmConfig } from "@/server/app-config"
import { OYD_CATEGORIES } from "../constants"
import { levelFor, ordinal } from "../lib/oyd-rules"
import type { OydCategory } from "../types"

/** What the notices need from a flag row. */
export interface FlagForNotice {
  id: string
  employeeId: string
  raisedById: string | null
  reviewedById: string | null
  category: string
  note: string
  employee: { firstName: string; lastName: string | null }
  raisedBy: { firstName: string; lastName: string | null } | null
}

const LINK = "/oyd"
const nameOf = (p: { firstName: string; lastName: string | null } | null) =>
  p ? `${p.firstName} ${p.lastName ?? ""}`.trim() : "Management"
const categoryLabel = (c: string) => OYD_CATEGORIES[c as OydCategory]?.label ?? c

async function hrIds(): Promise<string[]> {
  const rows = await db.employee.findMany({
    where: {
      isActive: true,
      ...VISIBLE_EMPLOYEE_FILTER,
      employeeRoles: {
        some: { role: { name: { in: [SYSTEM_ROLES.HR_MANAGER, SYSTEM_ROLES.HR_EMPLOYEE] } } },
      },
    },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

async function managersOf(employeeId: string) {
  const emp = await db.employee.findUnique({
    where: { id: employeeId },
    select: {
      manager: { select: { id: true, email: true, isActive: true } },
      dottedManager: { select: { id: true, email: true, isActive: true } },
    },
  })
  return [emp?.manager, emp?.dottedManager].filter(
    (m): m is { id: string; email: string; isActive: boolean } => Boolean(m?.isActive),
  )
}

export async function activeFlagCount(employeeId: string): Promise<number> {
  return db.oydFlag.count({ where: { employeeId, status: "CONFIRMED", removedAt: null } })
}

/** A teammate's flag waits for HR or the Reporting Manager. */
export async function notifyFlagRaised(flag: FlagForNotice): Promise<void> {
  const reviewers = new Set([
    ...(await hrIds()),
    ...(await managersOf(flag.employeeId)).map((m) => m.id),
  ])
  reviewers.delete(flag.employeeId)
  if (flag.raisedById) reviewers.delete(flag.raisedById)
  await createNotifications(
    [...reviewers].map((employeeId) => ({
      employeeId,
      title: "OYD flag to confirm",
      message: `${nameOf(flag.raisedBy)} raised a flag on ${nameOf(flag.employee)}: ${categoryLabel(flag.category)}.`,
      type: "warning",
      link: `${LINK}?tab=review`,
    })),
  )
}

/** It now counts: tell the employee and the raiser, alert HR at PIP and beyond, and send the mail. */
export async function notifyFlagConfirmed(flag: FlagForNotice): Promise<void> {
  const count = await activeFlagCount(flag.employeeId)
  const level = levelFor(count)
  if (!level) return

  await createNotification({
    employeeId: flag.employeeId,
    title: `OYD ${level.label}: ${categoryLabel(flag.category)}`,
    message: `${level.emoji} ${level.action}. ${flag.note.slice(0, 160)}`,
    type: "error",
    link: LINK,
  })
  if (flag.raisedById && flag.reviewedById && flag.raisedById !== flag.reviewedById) {
    await createNotification({
      employeeId: flag.raisedById,
      title: "Your OYD flag was confirmed",
      message: `Your flag on ${nameOf(flag.employee)} now counts (${level.label}).`,
      type: "info",
      link: LINK,
    })
  }
  if (count >= 3) {
    const alert = new Set([
      ...(await hrIds()),
      ...(await managersOf(flag.employeeId)).map((m) => m.id),
    ])
    alert.delete(flag.employeeId)
    await createNotifications(
      [...alert].map((employeeId) => ({
        employeeId,
        title: `${nameOf(flag.employee)} reached OYD ${level.label}`,
        message: `${level.emoji} ${level.action}.`,
        type: "error",
        link: `${LINK}?tab=team`,
      })),
    )
  }
  await sendFlagMail(flag, count)
}

export async function notifyFlagRejected(flag: FlagForNotice, reason: string): Promise<void> {
  if (!flag.raisedById) return
  await createNotification({
    employeeId: flag.raisedById,
    title: "Your OYD flag wasn't confirmed",
    message: `Your flag on ${nameOf(flag.employee)} won't count: ${reason}`,
    type: "info",
    link: `${LINK}?tab=raised`,
  })
}

export async function notifyFlagRemoved(flag: FlagForNotice, removerName: string): Promise<void> {
  const count = await activeFlagCount(flag.employeeId)
  await createNotification({
    employeeId: flag.employeeId,
    title: "An OYD flag was removed",
    message: `${removerName} removed your ${categoryLabel(flag.category).toLowerCase()} flag. You have ${count} active ${count === 1 ? "flag" : "flags"} now.`,
    type: "success",
    link: LINK,
  })
}

/** From the raiser's own mail (system mail without an App Password), HR and the RM on Cc. */
async function sendFlagMail(flag: FlagForNotice, count: number): Promise<void> {
  try {
    const level = levelFor(count)
    if (!level) return
    await warmConfig()
    const [employee, sender, managers, hrInbox] = await Promise.all([
      db.employee.findUnique({
        where: { id: flag.employeeId },
        select: { firstName: true, lastName: true, email: true },
      }),
      flag.raisedById
        ? db.employee.findUnique({
            where: { id: flag.raisedById },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              jobRole: { select: { name: true } },
              designation: { select: { title: true } },
            },
          })
        : null,
      managersOf(flag.employeeId),
      getConfig("HR_EMAIL"),
    ])
    if (!employee?.email) return

    const email = renderOydFlagEmail({
      employeeFirstName: employee.firstName,
      employeeName: nameOf(employee),
      countLabel: ordinal(count),
      level,
      categoryLabel: categoryLabel(flag.category),
      note: flag.note,
      senderName: sender ? nameOf(sender) : "HR, Digitally Next",
      senderDesignation: sender?.jobRole?.name ?? sender?.designation?.title ?? null,
      senderEmail: sender?.email ?? null,
      senderPhone: sender?.phone ?? null,
    })

    const skip = new Set([employee.email, sender?.email].map((e) => e?.toLowerCase()))
    const cc = [...new Set([hrInbox?.trim(), ...managers.map((m) => m.email)])].filter(
      (e): e is string => Boolean(e) && !skip.has(e?.toLowerCase()),
    )
    const mail = {
      to: employee.email,
      cc: cc.length ? cc : undefined,
      subject: email.subject,
      html: email.html,
      text: email.text,
      replyTo: sender?.email ?? undefined,
    }
    if (sender) addEmailAsJob(sender.id, { ...mail, profile: "notifications" })
    else addEmailJob({ ...mail, profile: "hr" })
  } catch (err) {
    console.error("[OYD_FLAG_MAIL]", err)
  }
}
