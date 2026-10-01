// One palette for every format. Each person gets a colour that follows them
// through the report: a badge, their bars, their project names in the tables.
// `ink` is the same hue darkened for small text on white (contrast >= 4.5:1).

export const INK = "161B33"
export const TEXT = "1F2433"
export const MUTED = "6B7085"
export const CARD = "F3F4F8"
export const LINE = "E2E4EC"
export const ZEBRA = "F7F8FB"
export const AMBER = "F4B740"
export const WARN = "B7791F"
export const WHITE = "FFFFFF"

const PEOPLE = [
  { color: "4C5BD4", ink: "4150C8" },
  { color: "E2702B", ink: "BF5516" },
  { color: "13998A", ink: "0D7D70" },
  { color: "C2417A", ink: "A8336A" },
  { color: "7A4FD6", ink: "6A3FC4" },
  { color: "2F8FCB", ink: "1D6FA3" },
  { color: "6E8B1E", ink: "566F12" },
  { color: "B7791F", ink: "8F5D10" },
]

export function personStyle(index: number): { color: string; ink: string } {
  return PEOPLE[index % PEOPLE.length]!
}

/** "DJ" for Diwakar Jha, "M" for a one-word name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  const first = parts[0]![0]!
  const last = parts.length > 1 ? parts[parts.length - 1]![0]! : ""
  return (first + last).toUpperCase()
}
