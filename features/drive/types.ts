// Shapes the Google Drive card, move tool and browser read from /api/admin/google-drive/*.

export interface DriveAccountInfo {
  email: string
  name: string | null
  photo: string | null
  connectedAt: string
  connectedBy: string | null
}

export interface DriveBackupRunInfo {
  runDate: string
  status: "RUNNING" | "DONE" | "FAILED"
  checked: number
  copied: number
  bytesCopied: number
  failed: number
  error: string | null
  startedAt: string
  finishedAt: string | null
}

export interface DriveStatus {
  /** OAuth client ID and secret are set (env or Integrations). */
  credentials: boolean
  account: DriveAccountInfo | null
  /** Google refused the stored access, or Drive couldn't be read. */
  error: string | null
  quota: {
    limit: number | null
    usage: number
    usageInDrive: number
    usageInDriveTrash: number
  } | null
  /** Where new Repository uploads go. */
  storage: "b2" | "drive"
  repository: { driveFiles: number; driveBytes: number; b2Files: number; b2Bytes: number }
  /** The company's "DNMS" folder, once it exists. */
  rootLink: string | null
  /** The old service-account Shared Drive is still configured. */
  sharedDrive: boolean
  backup: {
    last: DriveBackupRunInfo | null
    /** ISO time of the next run; null when nothing is connected. */
    nextAt: string | null
    files: number
    bytes: number
  }
}

export interface DriveMoveProject {
  id: string
  name: string
  code: string | null
  b2Files: number
  b2Bytes: number
  driveFiles: number
  /** Files still in the old Shared Drive (folders of this project). */
  sharedFiles: number
}

export interface DriveMoveFailure {
  project: string
  name: string
  error: string
}

export interface DriveMoveJob {
  running: boolean
  /** A project id, or "all". */
  scope: string
  current: string | null
  done: number
  total: number
  moved: number
  failed: DriveMoveFailure[]
  startedAt: string
  finishedAt: string | null
}

export interface DriveMoveState {
  /** The Repository writes to Drive, so moving makes sense. */
  canMove: boolean
  projects: DriveMoveProject[]
  job: DriveMoveJob | null
}

export interface DriveBrowseItem {
  id: string
  name: string
  mimeType: string
  size: number | null
  modifiedTime: string | null
  isFolder: boolean
  webViewLink: string | null
}

export interface DriveBrowseListing {
  folderId: string | null
  items: DriveBrowseItem[]
}
