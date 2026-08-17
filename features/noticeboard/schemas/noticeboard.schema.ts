import { z } from "zod"

export const announcementSchema = z.object({
  title: z.string().trim().min(3, "Give it a title").max(200),
  body: z.string().trim().min(3, "Write the announcement").max(20_000),
  category: z.string().trim().min(1, "Pick or type a category").max(60),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).default("NORMAL"),
  isPublished: z.boolean().default(true),
  /** Empty string = no expiry, which is what a blank date field sends. */
  expiresAt: z.string().trim().optional().or(z.literal("")),
})
export type AnnouncementInput = z.infer<typeof announcementSchema>
export type AnnouncementFormInput = z.input<typeof announcementSchema>

export const albumSchema = z.object({
  title: z.string().trim().min(2, "Give the album a name").max(150),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  eventDate: z.string().trim().optional().or(z.literal("")),
})
export type AlbumInput = z.infer<typeof albumSchema>
export type AlbumFormInput = z.input<typeof albumSchema>

/** Categories offered in the composer. Free text is still allowed. */
export const SUGGESTED_CATEGORIES = [
  "Information",
  "Holiday Notification",
  "Policy Update",
  "Event",
  "Celebration",
  "IT / System",
] as const

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
}
