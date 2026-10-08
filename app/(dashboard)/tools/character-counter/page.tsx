import type { Metadata } from "next"
import { CharacterCounter } from "@/features/tools"

export const metadata: Metadata = {
  title: "Character Counter",
  description: "Count words and characters against social and SEO limits.",
}

export default function Page() {
  return <CharacterCounter />
}
