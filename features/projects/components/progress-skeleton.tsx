import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function ProgressSkeleton() {
  return (
    <div className="space-y-6">
      {/* 1. Four KPI metric cards matching KpiRow */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="transition-colors">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3.5 w-3.5 rounded-full" />
              </div>
              <Skeleton className="mt-1 h-7 w-14" />
              <Skeleton className="mt-1 h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 2. Middle row: Status Donut (2 cols) & By Project (3 cols) */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Where the work stands (Donut chart + Status rows) */}
        <Card className="lg:col-span-2">
          <CardHeader className="border-border/60 border-b pb-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-1 h-3 w-48" />
          </CardHeader>
          <CardContent className="pt-4">
            {/* Donut ring simulation */}
            <div className="relative flex h-[210px] items-center justify-center">
              <div className="relative flex h-36 w-36 items-center justify-center rounded-full border-[14px] border-muted/50">
                <div className="flex flex-col items-center justify-center space-y-1">
                  <Skeleton className="h-6 w-10" />
                  <Skeleton className="h-2.5 w-14" />
                  <Skeleton className="h-2 w-16" />
                </div>
              </div>
            </div>

            {/* Status breakdown rows */}
            <div className="mt-3 space-y-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-3 rounded-sm px-2.5 py-1.5"
                >
                  <Skeleton className="h-2.5 w-2.5 rounded-full shrink-0" />
                  <div className="min-w-0 space-y-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-1 w-full rounded-full" />
                  </div>
                  <Skeleton className="h-3.5 w-6 justify-self-end" />
                  <Skeleton className="h-3.5 w-8 justify-self-end" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* By project table */}
        <Card className="lg:col-span-3">
          <CardHeader className="border-border/60 border-b pb-3">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="pt-4">
            <div className="w-full">
              {/* Table header */}
              <div className="grid grid-cols-7 gap-2 pb-3 border-b border-border/60">
                <Skeleton className="h-3 w-16 col-span-2" />
                <Skeleton className="h-3 w-12 justify-self-center" />
                <Skeleton className="h-3 w-10 justify-self-center" />
                <Skeleton className="h-3 w-12 justify-self-center" />
                <Skeleton className="h-3 w-12 justify-self-center" />
                <Skeleton className="h-3 w-16 justify-self-end" />
              </div>
              {/* Table rows */}
              <div className="divide-y divide-border/60">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-7 gap-2 py-3 items-center">
                    <div className="col-span-2 space-y-1.5">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                    <Skeleton className="h-3.5 w-6 justify-self-center" />
                    <Skeleton className="h-3.5 w-6 justify-self-center" />
                    <Skeleton className="h-3.5 w-6 justify-self-center" />
                    <Skeleton className="h-3.5 w-6 justify-self-center" />
                    <div className="flex items-center gap-2 justify-self-end w-full max-w-[110px]">
                      <Skeleton className="h-1.5 flex-1 rounded-full" />
                      <Skeleton className="h-3 w-6" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. By team member table */}
      <Card>
        <CardHeader className="border-border/60 border-b pb-3">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="pt-4">
          <div className="w-full">
            {/* Table header */}
            <div className="grid grid-cols-7 gap-2 pb-3 border-b border-border/60">
              <Skeleton className="h-3 w-16 col-span-2" />
              <Skeleton className="h-3 w-12 justify-self-center" />
              <Skeleton className="h-3 w-10 justify-self-center" />
              <Skeleton className="h-3 w-12 justify-self-center" />
              <Skeleton className="h-3 w-12 justify-self-center" />
              <Skeleton className="h-3 w-16 justify-self-end" />
            </div>
            {/* Table rows */}
            <div className="divide-y divide-border/60">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="grid grid-cols-7 gap-2 py-3 items-center">
                  <div className="col-span-2 space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                  <Skeleton className="h-3.5 w-6 justify-self-center" />
                  <Skeleton className="h-3.5 w-6 justify-self-center" />
                  <Skeleton className="h-3.5 w-6 justify-self-center" />
                  <Skeleton className="h-3.5 w-6 justify-self-center" />
                  <div className="flex items-center gap-2 justify-self-end w-full max-w-[110px]">
                    <Skeleton className="h-1.5 flex-1 rounded-full" />
                    <Skeleton className="h-3 w-6" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

