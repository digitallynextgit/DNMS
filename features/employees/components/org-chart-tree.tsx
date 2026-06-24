"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn, getInitials, getAvatarColor, employeeSlug } from "@/lib/utils"
import type { OrgNode } from "@/types"

export interface OrgChartTreeProps {
  nodes: OrgNode[]
}

// ─── Single node card ─────────────────────────────────────────────────────────

function OrgNodeCard({ node }: { node: OrgNode }) {
  const fullName = `${node.firstName} ${node.lastName}`
  const initials = getInitials(node.firstName, node.lastName)
  const avatarBg = getAvatarColor(fullName)

  return (
    <Link
      href={`/employees/${employeeSlug(node.employeeNo, node.firstName, node.lastName)}`}
      className="group flex flex-col items-center gap-1.5"
    >
      <div className="bg-card border-border group-hover:border-primary/40 w-36 rounded border px-3 py-2.5 text-center shadow-sm transition-all group-hover:shadow-md">
        <div className="mb-1.5 flex justify-center">
          <Avatar className="h-8 w-8">
            {node.profilePhoto ? <AvatarImage src={node.profilePhoto} alt={fullName} /> : null}
            <AvatarFallback className={cn("text-xs font-semibold text-white", avatarBg)}>
              {initials}
            </AvatarFallback>
          </Avatar>
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
      </div>
    </Link>
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
            /* Multiple children: horizontal rail */
            <div className="flex flex-col items-center">
              {/* Horizontal line */}
              <div
                className="bg-border h-px"
                style={{ width: `${Math.max(node.children.length * 160, 160)}px` }}
              />
              <div className="flex items-start gap-4">
                {node.children.map((child) => (
                  <div key={child.id} className="flex flex-col items-center">
                    {/* Vertical drop per child */}
                    <div className="bg-border h-6 w-px" />
                    <TreeNode node={child} depth={depth + 1} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Forest (multiple root nodes) ─────────────────────────────────────────────

export function OrgChartTree({ nodes }: OrgChartTreeProps) {
  if (nodes.length === 0) {
    return (
      <div className="text-muted-foreground flex items-center justify-center py-20 text-sm">
        No employees found in the org chart.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max flex-col items-center gap-12 p-8">
        {nodes.map((root) => (
          <TreeNode key={root.id} node={root} depth={0} />
        ))}
      </div>
    </div>
  )
}
