/**
 * Every project has the same six teams, listed in this order everywhere. The
 * teams are fixed - nobody creates, renames or deletes one, not even an admin.
 * What changes from project to project is staffing: who is on each team and
 * who manages it. New projects get all six on creation
 * (features/projects/server/project-teams.ts).
 */
export const PROJECT_TEAMS = ["WEB", "DESIGN", "MAP", "VIDEO", "AMG/SMO", "ADMIN"] as const

export type ProjectTeamName = (typeof PROJECT_TEAMS)[number]

/** The refusal every create / rename / delete attempt gets. */
export const TEAMS_ARE_FIXED = `Teams are fixed for every project (${PROJECT_TEAMS.join(", ")}) - add or remove people instead.`

/** Catalogue order. Anything outside the catalogue (legacy data) sorts last, A-Z. */
export function sortProjectTeams<T extends { name: string }>(teams: readonly T[]): T[] {
  const rank = (name: string) => {
    const i = (PROJECT_TEAMS as readonly string[]).indexOf(name)
    return i === -1 ? PROJECT_TEAMS.length : i
  }
  return [...teams].sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
}
