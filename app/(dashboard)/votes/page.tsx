import type { Metadata } from "next"
import { VotesBoard } from "@/features/votes"

export const metadata: Metadata = {
  title: "Votes",
  description: "Cast your vote in the company's events.",
}

export default function VotesPage() {
  return <VotesBoard />
}
