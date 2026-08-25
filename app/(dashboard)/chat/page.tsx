import { Suspense } from "react"

import { ChatView } from "@/features/chat"
import { Skeleton } from "@/components/ui/skeleton"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Chat",
  description: "Private team chat with attachments, voice notes and reactions.",
}

// A two-pane placeholder so the chat area is not blank until ChatView mounts:
// a column of conversation-row bars beside an empty thread panel, sized to the
// same shell the real view fills.
function ChatSkeleton() {
  return (
    <div className="flex h-full min-h-96 overflow-hidden rounded-sm border">
      <div className="w-full max-w-xs shrink-0 space-y-2 border-r p-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="bg-muted h-14 w-full animate-pulse rounded" />
        ))}
      </div>
      <div className="flex-1" />
    </div>
  )
}

// Suspense because ChatView reads ?c= via useSearchParams - without a boundary
// Next opts the whole route into client-side rendering and says so at build.
export default function ChatPage() {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ChatView />
    </Suspense>
  )
}
