import type { Metadata } from "next"
import { AiConnectionsClient } from "@/features/mcp"
import { mcpResource } from "@/features/mcp/server/config"

export const metadata: Metadata = { title: "AI Connections" }

// Routing glue only (CLAUDE.md rule #1). Open to every signed-in staff member:
// each sees their own connections; role:write also sees everyone's (enforced
// by the API).
export default function AiConnectionsPage() {
  return <AiConnectionsClient connectorUrl={mcpResource()} />
}
