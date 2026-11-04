export type VoteEventStatus = "DRAFT" | "UPCOMING" | "OPEN" | "CLOSED"

export interface VoteOptionEmployee {
  id: string
  firstName: string
  lastName: string
  employeeNo: string
  profilePhoto: string | null
}

export interface VoteOptionView {
  id: string
  label: string
  description: string | null
  position: number
  /** Null for a custom entry (a team, a desk). */
  employee: VoteOptionEmployee | null
  /** The uploaded photo, or the employee's profile photo. */
  photoUrl: string | null
  /** True when a photo was uploaded for this option (so it can be replaced). */
  hasPhoto: boolean
  /** Null while results are hidden from the reader. */
  votes: number | null
  /** This option is the reader. */
  isMe: boolean
  /** Who voted for this option, earliest first. Admin / HR view only, otherwise null. */
  voters: VoteBallotVoter[] | null
}

export interface VoteBallotVoter extends VoteOptionEmployee {
  votedAt: string
}

export interface VoteEventView {
  id: string
  title: string
  description: string | null
  opensAt: string | null
  closesAt: string
  publishedAt: string | null
  closedAt: string | null
  status: VoteEventStatus
  options: VoteOptionView[]
  /** The reader's own ballot. */
  myOptionId: string | null
  /** The reader may cast a ballot right now: open, a voter, and not voted yet (votes are final). */
  canVote: boolean
  /** Null while results are hidden from the reader. */
  totalVotes: number | null
  eligibleVoters: number | null
  /** Eligible employees who have not voted yet. Admin / HR view only, otherwise null. */
  notVoted: VoteOptionEmployee[] | null
  /** Leading option(s) once results are visible; several on a tie. */
  winnerOptionIds: string[]
  /** Closed early by an admin with the closing time still ahead, so it can be reopened. */
  canReopen: boolean
  createdAt: string
}
