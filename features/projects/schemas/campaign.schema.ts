import { z } from "zod"

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")

export const createCampaignSchema = z.object({
  name: z.string().trim().min(1, "Name the campaign").max(80),
  startDate: day,
  deadline: day,
  /** PROJECT_SERVICES codes; at least one. */
  services: z.array(z.string()).min(1, "Pick at least one service"),
  ownerId: z.string().uuid().nullable().optional(),
  brief: z.string().trim().max(4000).nullable().optional(),
})

export const updateCampaignSchema = createCampaignSchema.partial()

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>
