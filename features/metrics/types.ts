export interface MetricRow {
  id: string
  channel: string
  name: string
  unit: string
  howTo: string | null
  healthyMin: number | null
  healthyMax: number | null
  goodWhen: string
  healthyNote: string | null
  sortOrder: number
  /** The value for the week being viewed, and the week before it. */
  current: number | null
  previous: number | null
  note: string | null
}

export interface MetricsBoard {
  /** The Monday of the week on screen. */
  weekStart: string
  metrics: MetricRow[]
  canManage: boolean
  /** Weeks that already hold at least one number, newest first, for the picker. */
  filledWeeks: string[]
}
