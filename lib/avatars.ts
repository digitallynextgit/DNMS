// Preset avatars in public/avatars. A chosen preset is stored in Employee.profilePhoto as its public
// path, with profilePhotoKey null - that's what tells it apart from an uploaded photo.

export const AVATAR_EXT = "webp"

/** Keep in step with the image files. */
export const AVATARS_PER_ROLE = 6

export interface AvatarRole {
  key: string
  label: string
  /** Help text in the picker. */
  hint: string
}

export const AVATAR_ROLES: AvatarRole[] = [
  { key: "web", label: "Web & Development", hint: "Developers, engineers, QA" },
  { key: "design", label: "Design", hint: "UI/UX, creative, brand" },
  { key: "content", label: "Content", hint: "Writers, strategists, SEO" },
  { key: "video", label: "Video", hint: "Editors, videographers" },
  { key: "social", label: "Social & Marketing", hint: "SMO, ads, community" },
  { key: "hr", label: "HR & Admin", hint: "People ops, finance, admin" },
  { key: "lead", label: "Leadership", hint: "Managers, account managers" },
]

function idFor(roleKey: string, index: number): string {
  return `av-${roleKey}-${String(index + 1).padStart(2, "0")}`
}

export function avatarIdsForRole(roleKey: string): string[] {
  return Array.from({ length: AVATARS_PER_ROLE }, (_, i) => idFor(roleKey, i))
}

export const AVATAR_IDS: string[] = AVATAR_ROLES.flatMap((r) => avatarIdsForRole(r.key))

export const AVATAR_COUNT = AVATAR_IDS.length

export function avatarPath(id: string): string {
  return `/avatars/${id}.${AVATAR_EXT}`
}

const PATH_PATTERN = new RegExp(`^/avatars/(av-[a-z]+-\\d{2})\\.${AVATAR_EXT}$`)

export function isPresetAvatar(url: string | null | undefined): boolean {
  return !!url && PATH_PATTERN.test(url)
}

export function avatarIdFromPath(url: string | null | undefined): string | null {
  const id = url?.match(PATH_PATTERN)?.[1]
  return id && AVATAR_IDS.includes(id) ? id : null
}

export function roleOfAvatar(id: string): AvatarRole | null {
  const key = id.split("-")[1]
  return AVATAR_ROLES.find((r) => r.key === key) ?? null
}

export function isValidAvatarId(id: unknown): id is string {
  return typeof id === "string" && AVATAR_IDS.includes(id)
}
