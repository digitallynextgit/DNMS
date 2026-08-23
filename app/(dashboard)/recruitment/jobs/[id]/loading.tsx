import { Skeleton } from "@/components/ui/skeleton"

/**
 * Job pipeline (kanban) skeleton. Mirrors the real page's full-height layout: a
 * bordered header band with a back button + title/subtitle + action, then a
 * horizontally-scrolling board of six w-72 stage columns, each with a column
 * header and two ~8rem card placeholders, so the board keeps its geometry while
 * the job and its applicants load.
 */
export default function Loading() {
  return (
    <div className="flex h-full flex-col">
      {/* Header band (border-b, px-6) matching the real PageHeader wrapper */}
      <div className="bg-background border-b px-6">
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Skeleton className="bg-muted h-8 w-8 shrink-0 animate-pulse rounded" />
            <div className="space-y-2.5">
              <Skeleton className="bg-muted h-5 w-48 animate-pulse" />
              <Skeleton className="bg-muted h-4 w-64 animate-pulse" />
            </div>
          </div>
          <Skeleton className="bg-muted h-9 w-32 animate-pulse" />
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-w-max gap-4 p-6">
          {Array.from({ length: 6 }).map((_, col) => (
            <div key={col} className="flex w-72 shrink-0 flex-col">
              {/* Column header */}
              <div className="mb-3 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="bg-muted h-2 w-2 animate-pulse rounded" />
                  <Skeleton className="bg-muted h-4 w-20 animate-pulse" />
                </div>
                <Skeleton className="bg-muted h-5 w-6 animate-pulse rounded" />
              </div>
              {/* Drop zone with two card-shaped placeholders */}
              <div className="bg-muted/40 min-h-[200px] flex-1 rounded-[2px] border-2 border-transparent p-2">
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="bg-muted h-32 w-full animate-pulse rounded" />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
