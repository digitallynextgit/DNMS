"use client"

import { AvatarDisplay } from "@/components/shared/avatar-display"
import { LEAD_LABEL, type ProjectLeadRole } from "../lib/project-leads"
import type { LeadPerson, ProjectListItem } from "../hooks/use-projects"

type LeadSlots = Pick<ProjectListItem, "owner" | "secondaryAccountManager">

const SLOTS: { role: ProjectLeadRole; key: keyof LeadSlots; hint: string }[] = [
  { role: "ACCOUNT_MANAGER", key: "owner", hint: "Lead manager for this project" },
  {
    role: "SECONDARY_ACCOUNT_MANAGER",
    key: "secondaryAccountManager",
    hint: "Same powers, always on",
  },
]

const fullName = (p: LeadPerson) => `${p.firstName} ${p.lastName}`.trim()

/** The project's Account Managers, for the overview card. */
export function ProjectLeads({ project }: { project: LeadSlots }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {SLOTS.map(({ role, key, hint }) => {
        const person = project[key]
        return (
          <div key={role}>
            <p className="text-muted-foreground mb-2 text-[10px] font-medium tracking-widest uppercase">
              {LEAD_LABEL[role]}
            </p>
            {person ? (
              <div className="flex items-center gap-3">
                <AvatarDisplay
                  src={person.profilePhoto}
                  firstName={person.firstName}
                  lastName={person.lastName}
                  size="md"
                />
                <div>
                  <p className="font-medium">{fullName(person)}</p>
                  <p className="text-muted-foreground text-xs">{hint}</p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Not set</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** The edit dialog's Account Manager fields for a project: the ids, plus names for locked pickers. */
export function leadFormValues(p: LeadSlots) {
  const leadNames: Record<string, string> = {}
  for (const slot of SLOTS) {
    const person = p[slot.key]
    if (person) leadNames[person.id] = fullName(person)
  }
  return {
    accountManagerId: p.owner.id,
    secondaryAccountManagerId: p.secondaryAccountManager?.id ?? "",
    leadNames,
  }
}
