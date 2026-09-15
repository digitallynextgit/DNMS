// =============================================================================
// Write the default checklist templates into one tenant.
// =============================================================================
// Shared by all three places that need it, so the three cannot drift the way
// the role lists in this repo have:
//
//   features/tenants/server/provision.service.ts   a brand-new company
//   prisma/seed.ts                                 a fresh database
//   prisma/backfill-hr-checklists.ts               companies that already exist
//
// Takes a minimal client interface rather than importing `db`, because two of
// those three run as standalone tsx scripts and one runs inside a transaction.
// =============================================================================

import { DEFAULT_CHECKLIST_TEMPLATES, type DefaultChecklistTemplate } from "./default-templates"

/**
 * The slice of Prisma this needs. Structural, so the real client, a `tx` inside
 * `$transaction`, and a fake in a test all satisfy it without a cast.
 */
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
 * Seed both default templates for `tenantId`.
 *
 * IDEMPOTENT by design - it skips a kind the tenant already has rather than
 * replacing it. The backfill runs across every existing company and must never
 * overwrite a checklist HR has already edited; "already has one" is the whole
 * safety condition.
 *
 * Every row passes `tenantId` EXPLICITLY. The tenant guard stamps top-level
 * writes from ambient context, but these callers run outside a request (a seed
 * script, a provisioning transaction for a tenant that is not the caller's), so
 * the id is passed rather than inferred. The guard's spread order puts an
 * explicit value first, so it wins.
 *
 * Rows are created one at a time rather than nested under the template: the
 * guard does not stamp NESTED writes, so nested children would fall back to the
 * founding tenant's column default and land in the wrong company.
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
