import type { Metadata } from "next"
import { AiConnectionsClient } from "@/features/mcp"
import { mcpResource } from "@/features/mcp/server/config"

export const metadata: Metadata = { title: "AI Connections" }

// Open to all staff: each sees their own connections; role:write sees everyone's (API-enforced).
export default function AiConnectionsPage() {
  return <AiConnectionsClient connectorUrl={mcpResource()} />
}
