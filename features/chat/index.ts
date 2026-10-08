// Client-safe barrel: server modules stay private.
export { sendMessageSchema, startConversationSchema } from "./schemas/chat.schema"
export type { SendMessageInput, StartConversationInput } from "./schemas/chat.schema"
export { ChatView } from "./components/chat-view"
