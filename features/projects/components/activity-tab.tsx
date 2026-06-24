"use client"

import { useProjectActivity, type ProjectActivity } from "@/features/projects/hooks/use-projects"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { getInitials, formatDate } from "@/lib/utils"
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
  const { data, isLoading } = useProjectActivity(projectId)
  const activities = data?.data ?? []

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded" />
        ))}
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="text-muted-foreground py-12 text-center text-sm">
          No activity yet. Actions like creating tasks, posting comments, and changing statuses will
          appear here.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="bg-border absolute top-4 bottom-4 left-[18px] w-px" />

      <div className="space-y-1">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3 py-2 pl-1">
            {/* Icon bubble */}
            <div className="bg-background border-border relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border">
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

            <Avatar className="mt-1 h-6 w-6 shrink-0">
              {activity.actor.profilePhoto && <AvatarImage src={activity.actor.profilePhoto} />}
              <AvatarFallback className="text-[8px]">
                {getInitials(activity.actor.firstName, activity.actor.lastName)}
              </AvatarFallback>
            </Avatar>
          </div>
        ))}
      </div>
    </div>
  )
}
