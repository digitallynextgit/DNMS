/**
 * Route-level loader.
 *
 * Two motions, deliberately out of step: the square rotates, and a bright segment
 * runs around its perimeter at roughly twice that rate. The old `border-t-primary`
 * version painted the highlight onto one edge, so it only ever went round with the
 * box; here the white part travels the outline on its own, which is what reads as
 * "still working" rather than "one corner is a different colour".
 */
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div role="status" aria-label="Loading">
        <svg viewBox="0 0 40 40" className="square-loader h-8 w-8" fill="none" aria-hidden="true">
          {/* Static track - keeps the square legible while the highlight is elsewhere. */}
          <rect
            x="4"
            y="4"
            width="32"
            height="32"
            rx="2"
            strokeWidth="4"
            className="stroke-muted"
          />
          {/* pathLength normalises the perimeter to 100, so "25 75" is literally a
              quarter-of-the-outline segment - no per-size or per-radius magic numbers. */}
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
