import type { FnfStatus, NoticePeriod } from "./lib/fnf"

export interface FullFinalRow {
  id: string
  /** Set when the leaver was in DNMS; their last working day then comes from the profile. */
  employeeId: string | null
  name: string
  designation: string | null
  lastWorkingDate: string
  dueDate: string
  releasedOn: string | null
  noticePeriod: NoticePeriod | null
  relievingGiven: boolean
  relievingDate: string | null
  notes: string | null
  employee: {
    id: string
    employeeNo: string
    firstName: string
    lastName: string
    profilePhoto: string | null
  } | null
  status: FnfStatus
}
