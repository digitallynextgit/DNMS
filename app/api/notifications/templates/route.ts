import { NextRequest, NextResponse } from "next/server"
import { withAuth } from "@/server/api-handler"
import { db } from "@/server/db"
import { emailTemplateSchema } from "@/features/admin/schemas/email-template.schema"
import { PERMISSIONS } from "@/lib/constants"
import type { Session } from "next-auth"

// GET - list all email templates
export const GET = withAuth(
  PERMISSIONS.EMAIL_TEMPLATE_READ,
  async (_req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const templates = await db.emailTemplate.findMany({
        orderBy: { createdAt: "desc" },
      })
      return NextResponse.json({ data: templates })
    } catch (error) {
      console.error("[notifications/templates] GET error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// POST - create a new email template
export const POST = withAuth(
  PERMISSIONS.EMAIL_TEMPLATE_WRITE,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const body = await req.json()
      const result = emailTemplateSchema.safeParse(body)

      if (!result.success) {
        return NextResponse.json(
          { error: "Validation failed", details: result.error.flatten() },
          { status: 422 },
        )
      }

      const data = result.data

      // Slug uniqueness check
      const existing = await db.emailTemplate.findUnique({
        where: { slug: data.slug },
      })
      if (existing) {
        return NextResponse.json(
          { error: `A template with slug '${data.slug}' already exists` },
          { status: 409 },
        )
      }

      const template = await db.emailTemplate.create({
        data: {
          slug: data.slug,
          name: data.name,
          subject: data.subject,
          bodyHtml: data.bodyHtml,
          bodyText: data.bodyText ?? null,
          mergeFields: data.mergeFields,
          isActive: data.isActive,
          trigger: data.trigger ?? null,
        },
      })

      return NextResponse.json({ data: template }, { status: 201 })
    } catch (error) {
      console.error("[notifications/templates] POST error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)

// PATCH - update an existing template (id must be in body)
export const PATCH = withAuth(
  PERMISSIONS.EMAIL_TEMPLATE_WRITE,
  async (req: NextRequest, _ctx: { params: Record<string, string> }, _session: Session) => {
    try {
      const body = await req.json()
      const { id, ...rest } = body

      if (!id) {
        return NextResponse.json({ error: "Template id is required" }, { status: 400 })
      }

      const existing = await db.emailTemplate.findUnique({ where: { id } })
      if (!existing) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 })
      }

      // Partial parse - allow partial updates
      const result = emailTemplateSchema.partial().safeParse(rest)
      if (!result.success) {
        return NextResponse.json(
          { error: "Validation failed", details: result.error.flatten() },
          { status: 422 },
        )
      }

      const data = result.data

      // If slug is changing, ensure uniqueness
      if (data.slug && data.slug !== existing.slug) {
        const conflict = await db.emailTemplate.findUnique({
          where: { slug: data.slug },
        })
        if (conflict) {
          return NextResponse.json(
            { error: `A template with slug '${data.slug}' already exists` },
            { status: 409 },
          )
        }
      }

      const updated = await db.emailTemplate.update({
        where: { id },
        data: {
          ...(data.slug !== undefined && { slug: data.slug }),
          ...(data.name !== undefined && { name: data.name }),
          ...(data.subject !== undefined && { subject: data.subject }),
          ...(data.bodyHtml !== undefined && { bodyHtml: data.bodyHtml }),
          ...(data.bodyText !== undefined && { bodyText: data.bodyText }),
          ...(data.mergeFields !== undefined && { mergeFields: data.mergeFields }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.trigger !== undefined && { trigger: data.trigger }),
        },
      })

      return NextResponse.json({ data: updated })
    } catch (error) {
      console.error("[notifications/templates] PATCH error:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  },
)
