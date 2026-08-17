import { z } from "zod"

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1, "Type a message").max(4000, "Message is too long"),
})
export type SendMessageInput = z.infer<typeof sendMessageSchema>

export const startConversationSchema = z.object({
  employeeId: z.string().uuid("Pick someone to message"),
})
export type StartConversationInput = z.infer<typeof startConversationSchema>

export const editMessageSchema = z.object({
  body: z.string().trim().min(1, "Message cannot be empty").max(4000, "Message is too long"),
})
export type EditMessageInput = z.infer<typeof editMessageSchema>

/** Who a deletion applies to. */
export const deleteScopeSchema = z.enum(["me", "everyone"])
export type DeleteScope = z.infer<typeof deleteScopeSchema>
