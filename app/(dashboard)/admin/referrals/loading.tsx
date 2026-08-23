import { PageHeaderSkeleton, ListSkeleton } from "@/components/shared/loading-skeleton"

// Referrals: header (no actions) + a stacked list of referral reward cards.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <ListSkeleton rows={5} height="h-20" />
    </div>
  )
}
