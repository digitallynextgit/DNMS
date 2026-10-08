/** Two motions out of step: the square rotates while a bright segment runs round its outline. */
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div role="status" aria-label="Loading">
        <svg viewBox="0 0 40 40" className="square-loader h-8 w-8" fill="none" aria-hidden="true">
          <rect
            x="4"
            y="4"
            width="32"
            height="32"
            rx="2"
            strokeWidth="4"
            className="stroke-muted"
          />
          {/* pathLength normalises the perimeter to 100, so "25 75" is a quarter-outline segment. */}
          <rect
            x="4"
            y="4"
            width="32"
            height="32"
            rx="2"
            pathLength={100}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="25 75"
            className="square-loader-run stroke-primary"
          />
        </svg>
        <span className="sr-only">Loading</span>
      </div>
    </div>
  )
}
