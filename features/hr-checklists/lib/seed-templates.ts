// Writes the default checklist templates into one tenant (provisioning and prisma/seed.ts).

import { DEFAULT_CHECKLIST_TEMPLATES, type DefaultChecklistTemplate } from "./default-templates"

/** The slice of Prisma this needs - the real client, a `tx`, or a test fake all fit. */
export interface ChecklistSeedClient {
  checklistTemplate: {
    findFirst(args: {
      where: { tenantId: string; kind: "ONBOARDING" | "EXIT" }
      select: { id: true }
    }): Promise<{ id: string } | null>
    create(args: {
      data: {
        tenantId: string
        kind: "ONBOARDING" | "EXIT"
        name: string
        description: string
      }
      select: { id: true }
    }): Promise<{ id: string }>
  }
  checklistTemplateSection: {
    create(args: {
      data: { tenantId: string; templateId: string; title: string; displayOrder: number }
      select: { id: true }
    }): Promise<{ id: string }>
  }
  checklistTemplateItem: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>
  }
}

export interface SeedResult {
  created: ("ONBOARDING" | "EXIT")[]
  skipped: ("ONBOARDING" | "EXIT")[]
}

/**
 * Seed both default templates for `tenantId`. Idempotent: skips a kind the tenant already has.
 * `tenantId` is passed explicitly (callers run outside a request), and rows are created one at a
 * time because the tenant guard doesn't stamp nested writes.
 */
export async function seedChecklistTemplates(
  client: ChecklistSeedClient,
  tenantId: string,
  templates: DefaultChecklistTemplate[] = DEFAULT_CHECKLIST_TEMPLATES,
): Promise<SeedResult> {
  const result: SeedResult = { created: [], skipped: [] }

  for (const template of templates) {
    const existing = await client.checklistTemplate.findFirst({
      where: { tenantId, kind: template.kind },
      select: { id: true },
    })
    if (existing) {
      result.skipped.push(template.kind)
      continue
    }

    const created = await client.checklistTemplate.create({
      data: {
        tenantId,
        kind: template.kind,
        name: template.name,
        description: template.description,
      },
      select: { id: true },
    })

    for (const [sectionIndex, section] of template.sections.entries()) {
      const createdSection = await client.checklistTemplateSection.create({
        data: {
          tenantId,
          templateId: created.id,
          title: section.title,
          displayOrder: sectionIndex,
        },
        select: { id: true },
      })

      for (const [itemIndex, item] of section.items.entries()) {
        await client.checklistTemplateItem.create({
          data: {
            tenantId,
            sectionId: createdSection.id,
            text: item.text,
            helpText: item.helpText ?? null,
            itemKind: item.itemKind ?? "TASK",
            assigneeRole: item.assigneeRole ?? "HR",
            isRequired: item.isRequired ?? true,
            offsetDays: item.offsetDays ?? null,
            displayOrder: itemIndex,
          },
        })
      }
    }

    result.created.push(template.kind)
  }

  return result
}
