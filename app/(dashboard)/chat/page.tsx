import { Suspense } from "react"

import { ChatView } from "@/features/chat"
import type { Metadata } from "next"

export const metadata: Metadata = { title: "Chat" }

// Suspense because ChatView reads ?c= via useSearchParams - without a boundary
// Next opts the whole route into client-side rendering and says so at build.
export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatView />
    </Suspense>
  )
}
