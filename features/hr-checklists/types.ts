// Row shapes the checklist screens read. Declared here rather than inferred
// from Prisma so the client bundle never reaches into generated server types.

export type ChecklistKind = "ONBOARDING" | "EXIT"
export type ChecklistItemKind = "TASK" | "CLEARANCE"
export type ChecklistStatus = "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
export type ChecklistAssigneeRole = "HR" | "MANAGER" | "EMPLOYEE" | "DEPARTMENT_HEAD"

export interface ChecklistPerson {
  id: string
  firstName: string
  lastName: string
  profilePhoto?: string | null
}

export interface ChecklistEmployee extends ChecklistPerson {
  employeeNo: string
  designation?: { title: string } | null
  department?: { name: string } | null
  dateOfJoining?: string | null
  lastWorkingDate?: string | null
}

export interface ChecklistProgressView {
  total: number
  done: number
  percent: number
  clearancesTotal: number
  clearancesDone: number
}

export interface ChecklistItem {
  id: string
  sectionTitle: string
  text: string
  helpText: string | null
  itemKind: ChecklistItemKind
  assigneeRole: ChecklistAssigneeRole
  assigneeId: string | null
  isRequired: boolean
  dueDate: string | null
  displayOrder: number
  isAdHoc: boolean
  isDone: boolean
  doneAt: string | null
  note: string | null
  assignee: ChecklistPerson | null
  doneBy: ChecklistPerson | null
}

export interface ChecklistListRow {
  id: string
  kind: ChecklistKind
  status: ChecklistStatus
  anchorDate: string | null
  completedAt: string | null
  createdAt: string
  employee: ChecklistEmployee
  progress: ChecklistProgressView
}

export interface ChecklistDetail {
  id: string
  kind: ChecklistKind
  status: ChecklistStatus
  anchorDate: string | null
  cancelReason: string | null
  completedAt: string | null
  createdAt: string
  employee: ChecklistEmployee
  completedBy: ChecklistPerson | null
  resignation: {
    id: string
    status: string
    requestedLastWorkingDate: string | null
    reason: string | null
  } | null
  items: ChecklistItem[]
  progress: ChecklistProgressView
  /** What THIS viewer may do - the server's answer, not a guess from roles. */
  canWrite: boolean
  myItemIds: string[]
}

/** A row in the "awaiting my sign-off" inbox. */
export interface MyChecklistItem extends ChecklistItem {
  instance: {
    id: string
    kind: ChecklistKind
    anchorDate: string | null
    employee: ChecklistEmployee
  }
}
