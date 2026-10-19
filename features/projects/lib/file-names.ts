// Same-name checks for the Repository: one folder shouldn't quietly get two files called the same.

/** What makes two names "the same" to a person: case and outer spaces don't count. */
export function nameKey(name: string): string {
  return name.trim().toLowerCase()
}

const NUMBERED = /^(.*?)\s*\((\d+)\)$/

/**
 * The first "name (n).ext" not in `taken` (keys from nameKey). Folders and links pass
 * `hasExtension: false`, so "v1.2" isn't read as a name and an extension.
 */
export function freeName(name: string, taken: ReadonlySet<string>, hasExtension = true): string {
  const trimmed = name.trim()
  const dot = hasExtension ? trimmed.lastIndexOf(".") : -1
  const split = dot > 0 && dot < trimmed.length - 1
  const ext = split ? trimmed.slice(dot) : ""
  let base = (split ? trimmed.slice(0, dot) : trimmed).trimEnd()
  let n = 1
  const numbered = NUMBERED.exec(base)
  if (numbered) {
    base = numbered[1]!.trimEnd()
    n = Number(numbered[2]) + 1
  }
  for (; ; n++) {
    const candidate = `${base} (${n})${ext}`
    if (!taken.has(nameKey(candidate))) return candidate
  }
}
