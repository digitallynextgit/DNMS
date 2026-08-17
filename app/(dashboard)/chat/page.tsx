import { ChatView } from "@/features/chat"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Chat" }

export default function ChatPage() {
  return <ChatView />
}
