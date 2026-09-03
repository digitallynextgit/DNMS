"use client"

import { useState } from "react"
import { useProjectActivity, type ProjectActivity } from "@/features/projects/hooks/use-projects"
import { AvatarDisplay } from "@/components/shared/avatar-display"
import { EmptyState } from "@/components/shared/empty-state"
import { ListSkeleton } from "@/components/shared/loading-skeleton"
import { formatDate, cn } from "@/lib/utils"
import {
  CheckCircle2,
  GitCommit,
  MessageSquare,
  UserPlus,
  UserMinus,
  Milestone,
  Users,
  FileText,
  ArrowRight,
  Activity,
} from "lucide-react"

interface Props {
  projectId: string
}

function getActivityIcon(type: string) {
  switch (type) {
    case "TASK_CREATED":
      return <GitCommit className="h-3.5 w-3.5" />
    case "TASK_STATUS_CHANGED":
      return <ArrowRight className="h-3.5 w-3.5" />
    case "TASK_APPROVED":
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
    case "TASK_REJECTED":
      return <CheckCircle2 className="h-3.5 w-3.5 text-red-500" />
    case "COMMENT_ADDED":
      return <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
    case "TEAM_MEMBER_ADDED":
      return <UserPlus className="h-3.5 w-3.5 text-emerald-600" />
    case "TEAM_MEMBER_REMOVED":
      return <UserMinus className="h-3.5 w-3.5 text-red-500" />
    case "MILESTONE_TOGGLED":
      return <Milestone className="h-3.5 w-3.5 text-purple-600" />
    case "TEAM_CREATED":
      return <Users className="h-3.5 w-3.5" />
    case "MESSAGE_POSTED":
      return <FileText className="h-3.5 w-3.5 text-amber-600" />
    default:
      return <GitCommit className="h-3.5 w-3.5" />
  }
}

function getActivityText(activity: ProjectActivity): string {
  const meta = activity.meta ?? {}
  switch (activity.type) {
    case "TASK_CREATED":
      return `created task "${meta.taskTitle ?? ""}"`
    case "TASK_STATUS_CHANGED":
      return `changed "${meta.taskTitle ?? ""}" from ${humanStatus(meta.from as string)} to ${humanStatus(meta.to as string)}`
    case "TASK_APPROVED":
      return `approved task "${meta.taskTitle ?? ""}"`
    case "TASK_REJECTED":
      return `rejected task "${meta.taskTitle ?? ""}"`
    case "COMMENT_ADDED":
      return `commented on "${meta.taskTitle ?? ""}"`
    case "TEAM_MEMBER_ADDED":
      return `added a member to ${meta.teamName ?? "a team"}`
    case "TEAM_MEMBER_REMOVED":
      return `removed a member from ${meta.teamName ?? "a team"}`
    case "MILESTONE_TOGGLED":
      return (meta.isMilestone ? "marked" : "unmarked") + ` "${meta.taskTitle ?? ""}" as milestone`
    case "TEAM_CREATED":
      return `created team "${meta.teamName ?? ""}"`
    case "MESSAGE_POSTED":
      return `posted a message: "${meta.title ?? ""}"`
    default:
      return activity.type.toLowerCase().replace(/_/g, " ")
  }
}

function humanStatus(s: string): string {
  const map: Record<string, string> = {
    TODO: "To Do",
    IN_PROGRESS: "In Progress",
    IN_REVIEW: "In Review",
    DONE: "Done",
  }
  return map[s] ?? s
}

export function ActivityTab({ projectId }: Props) {
  // Key events by DEFAULT. The full feed is mostly routine task churn, so opening
  // this tab should answer "what happened here" rather than "what happened in the
  // last fifty clicks". Everything is one toggle away, never hidden.
  const [keyOnly, setKeyOnly] = useState(true)
  const { data, isLoading } = useProjectActivity(projectId, keyOnly)
  const activities = data?.data ?? []

  const toggle = (
    <div className="bg-muted mb-3 inline-flex rounded-sm p-0.5">
      {(
        [
          { value: true, label: "Key events" },
          { value: false, label: "Everything" },
        ] as const
      ).map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => setKeyOnly(o.value)}
          aria-pressed={keyOnly === o.value}
          className={cn(
            "rounded-sm px-2.5 py-1 text-xs transition-colors",
            keyOnly === o.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )

  if (isLoading) {
    return (
      <>
        {toggle}
        <ListSkeleton rows={5} height="h-12" className="space-y-3" />
      </>
    )
  }

  if (activities.length === 0) {
    return (
      <>
        {toggle}
        <EmptyState
          compact
          icon={Activity}
          title={keyOnly ? "No key events yet" : "No activity yet"}
          description={
            keyOnly
              ? "Approvals, completions, team changes and requirements show up here. Switch to Everything for the full feed."
              : "Actions like creating tasks, posting comments, and changing statuses will appear here."
          }
        />
      </>
    )
  }

  return (
    <div className="relative">
      {toggle}
      {/* Timeline line */}
      <div className="bg-border absolute top-4 bottom-4 left-[18px] w-px" />

      <div className="space-y-1">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3 py-2 pl-1">
            {/* Icon bubble */}
            <div className="bg-background border-border relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border">
              {getActivityIcon(activity.type)}
            </div>

            <div className="min-w-0 flex-1 pt-1.5">
              <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <span className="text-xs font-medium">
                  {activity.actor.firstName} {activity.actor.lastName}
                </span>
                <span className="text-muted-foreground text-xs">{getActivityText(activity)}</span>
              </div>
              <p className="text-muted-foreground mt-0.5 text-[10px]">
                {formatDate(activity.createdAt)}
              </p>
            </div>

            <AvatarDisplay
              src={activity.actor.profilePhoto}
              firstName={activity.actor.firstName}
              lastName={activity.actor.lastName}
              size="chip"
              className="mt-1 shrink-0"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
