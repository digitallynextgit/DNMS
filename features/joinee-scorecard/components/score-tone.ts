import { TONE } from "@/lib/constants"
import { ratingFor } from "../lib/scorecard"

/** Colour for a 1-5 score, shared by the scorecard and the weekly review. */
export const SCORE_TONE: Record<number, string> = {
  5: TONE.green,
  4: TONE.emerald,
  3: TONE.amber,
  2: TONE.orange,
  1: TONE.red,
}

/** Colour for an average, by the guide entry it rounds to. */
export const toneFor = (score: number | null) =>
  score === null ? "" : (SCORE_TONE[ratingFor(score)?.score ?? 0] ?? "")
