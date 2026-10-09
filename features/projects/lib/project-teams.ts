/** The fixed teams every project gets, in display order. Only staffing varies per project. */
export const PROJECT_TEAMS = [
  "AM",
  "WEB",
  "DESIGN",
  "VIDEO",
  "CONTENT",
  "SMO",
  "SEO",
  "PERFORMANCE",
  "PR",
  "ALLIANCES & PARTNERSHIPS",
  "ADMIN",
] as const

export type ProjectTeamName = (typeof PROJECT_TEAMS)[number]

/** Holds the project's Account Manager (its owner) as manager. */
export const ACCOUNT_MANAGER_TEAM: ProjectTeamName = "AM"

export const TEAMS_ARE_FIXED = `Teams are fixed for every project (${PROJECT_TEAMS.join(", ")}) - add or remove people instead.`

/** Catalogue order. Anything outside the catalogue (legacy data) sorts last, A-Z. */
export function sortProjectTeams<T extends { name: string }>(teams: readonly T[]): T[] {
  const rank = (name: string) => {
    const i = (PROJECT_TEAMS as readonly string[]).indexOf(name)
    return i === -1 ? PROJECT_TEAMS.length : i
  }
  return [...teams].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
}
