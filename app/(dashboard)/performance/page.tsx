import { redirect } from "next/navigation"

// The Performance module is the self + manager evaluation scorecard.
export default function PerformancePage() {
  redirect("/performance/evaluations")
}
