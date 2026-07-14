"use client"

import { useCallback, useLayoutEffect, useRef, useState } from "react"
import { ChevronDown, ChevronRight, Users, Minus, Plus, Maximize2 } from "lucide-react"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { OrgNode } from "@/types"

export interface OrgChartTreeProps {
  nodes: OrgNode[]
}

// ─── Single node card ─────────────────────────────────────────────────────────

function OrgNodeCard({ node }: { node: OrgNode }) {
  const fullName = `${node.firstName} ${node.lastName}`

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="bg-card border-border w-36 rounded border px-3 py-2.5 text-center shadow-sm">
        <div className="mb-1.5 flex justify-center">
          <AvatarDisplay
            src={node.profilePhoto}
            firstName={node.firstName}
            lastName={node.lastName}
            size="sm"
          />
        </div>
        <p className="text-foreground truncate text-xs leading-tight font-semibold">{fullName}</p>
        {node.designation?.title && (
          <p className="text-muted-foreground mt-0.5 truncate text-[10px]">
            {node.designation.title}
          </p>
        )}
        {node.department?.name && (
          <p className="text-muted-foreground/70 truncate text-[10px]">{node.department.name}</p>
        )}
        {node.role && (
          <span className="bg-muted text-muted-foreground mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-medium">
            {node.role}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Recursive tree node ───────────────────────────────────────────────────────

function TreeNode({ node, depth = 0 }: { node: OrgNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = node.children.length > 0

  return (
    <div className="flex flex-col items-center">
      {/* Node card + toggle */}
      <div className="relative flex flex-col items-center">
        <OrgNodeCard node={node} />

        {hasChildren && (
          <button
            onClick={() => setExpanded((p) => !p)}
            className="text-muted-foreground hover:text-foreground mt-1 flex items-center gap-0.5 text-[10px] transition-colors"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {node.children.length} {node.children.length === 1 ? "report" : "reports"}
          </button>
        )}
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div className="flex flex-col items-center">
          {/* Vertical line from parent down */}
          <div className="bg-border h-6 w-px" />

          {node.children.length === 1 ? (
            /* Single child: straight line */
            <TreeNode node={node.children[0]} depth={depth + 1} />
          ) : (
            /* Multiple children: each draws its own connector so the rail lines up
               with the actual card centres regardless of differing subtree widths. */
            <div className="flex items-start">
              {node.children.map((child, i) => {
                const isFirst = i === 0
                const isLast = i === node.children.length - 1
                return (
                  <div key={child.id} className="relative flex flex-col items-center px-2 pt-6">
                    {/* Horizontal rail: only the right half for the first child and
                        the left half for the last, so it spans centre-to-centre. */}
                    <div
                      className={cn(
                        "bg-border absolute top-0 h-px",
                        isFirst ? "right-0 left-1/2" : isLast ? "right-1/2 left-0" : "inset-x-0",
                      )}
                    />
                    {/* Vertical drop into this child (at the card's centre). */}
                    <div className="bg-border absolute top-0 left-1/2 h-6 w-px -translate-x-1/2" />
                    <TreeNode node={child} depth={depth + 1} />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Forest (multiple root nodes) ─────────────────────────────────────────────

export function OrgChartTree({ nodes }: OrgChartTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  // Natural (unscaled) content size + the scale that makes it fit the container
  // width. transform:scale doesn't affect scrollWidth/Height, so these stay natural.
  const [dims, setDims] = useState({ natW: 0, natH: 0, fit: 1 })
  const [manualScale, setManualScale] = useState<number | null>(null)

  const measure = useCallback(() => {
    const c = containerRef.current
    const inner = contentRef.current
    if (!c || !inner) return
    const natW = inner.scrollWidth
    const natH = inner.scrollHeight
    const fit = natW > 0 ? Math.min(1, c.clientWidth / natW) : 1
    setDims((prev) =>
      prev.natW === natW && prev.natH === natH && prev.fit === fit ? prev : { natW, natH, fit },
    )
  }, [])

  // Re-fit on mount, when the tree changes, and on container/content resize
  // (expand/collapse a branch, window resize).
  useLayoutEffect(() => {
    measure()
    const ro = new ResizeObserver(measure)
    if (containerRef.current) ro.observe(containerRef.current)
    if (contentRef.current) ro.observe(contentRef.current)
    return () => ro.disconnect()
  }, [measure, nodes])

  if (nodes.length === 0) {
    return <EmptyState icon={Users} title="No employees found in the org chart." />
  }

  const scale = manualScale ?? dims.fit
  const scaled = dims.natW > 0

  return (
    <div className="relative">
      {/* Zoom controls */}
      <div className="bg-card/90 absolute top-3 right-3 z-10 flex items-center gap-0.5 rounded border p-0.5 shadow-sm backdrop-blur">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setManualScale(Math.max(0.3, Math.round((scale - 0.1) * 10) / 10))}
          title="Zoom out"
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="text-muted-foreground w-9 text-center text-xs tabular-nums">
          {Math.round(scale * 100)}%
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setManualScale(Math.min(1.5, Math.round((scale + 0.1) * 10) / 10))}
          title="Zoom in"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setManualScale(null)}
          title="Fit to screen"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div ref={containerRef} className="w-full overflow-auto">
        <div
          className="mx-auto overflow-hidden"
          style={scaled ? { width: dims.natW * scale, height: dims.natH * scale } : undefined}
        >
          <div
            ref={contentRef}
            style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
          >
            <div className="flex min-w-max flex-col items-center gap-12 p-8">
              {nodes.map((root) => (
                <TreeNode key={root.id} node={root} depth={0} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
