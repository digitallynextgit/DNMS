// Public API for the "chat" feature (CLAUDE.md §1, rule #2).
// Server modules stay private - this barrel is imported by client components.
export { sendMessageSchema, startConversationSchema } from "./schemas/chat.schema"
export type { SendMessageInput, StartConversationInput } from "./schemas/chat.schema"
export { ChatView } from "./components/chat-view"
export { EmojiPicker } from "./components/emoji-picker"
