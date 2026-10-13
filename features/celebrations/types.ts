export interface BirthdayShowProps {
  name: string
  /** Empty for the plain greeting; the special show spotlights each photo in turn. */
  photos: { src: string; caption: string; line: string }[]
  message: string
  wish: string
  signature: string
  /** Set for onlookers (admins): play once per browser, then only on the replay button. */
  onceKey?: string
}

export interface BirthdayViewer {
  id: string
  email?: string | null
  roles?: readonly string[]
  firstName?: string
  dateOfBirth?: Date | null
}
