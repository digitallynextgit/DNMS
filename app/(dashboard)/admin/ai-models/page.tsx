import type { Metadata } from "next"
import { AiModelsManager } from "@/features/ai-models"

export const metadata: Metadata = {
  title: "AI Models",
  description: "The AI providers and keys DNMS uses, and the order they are tried in.",
}

export default function AiModelsPage() {
  return <AiModelsManager />
}
