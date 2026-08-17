import { z } from "zod"

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1, "Type a message").max(4000, "Message is too long"),
})
export type SendMessageInput = z.infer<typeof sendMessageSchema>

export const startConversationSchema = z.object({
  employeeId: z.string().uuid("Pick someone to message"),
})
export type StartConversationInput = z.infer<typeof startConversationSchema>
