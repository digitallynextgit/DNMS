import "server-only"

import { readFileSync } from "fs"
import { google, type drive_v3 } from "googleapis"
import { getConfig } from "@/server/app-config"
import { currentTenant } from "@/server/tenant-context"
import { tenantFromRequestHeaders } from "@/server/tenant-guard"
import { FOUNDING_TENANT_ID, FOUNDING_TENANT_SLUG } from "@/lib/tenant-url"
import { connectedDrive, isDriveAccountConnected } from "@/lib/google-drive-oauth"

// Two Drives. "account": the Google account connected in Admin -> Integrations, with one root folder
// per company; the Repository uses it once REPOSITORY_STORAGE is "drive". "shared": the older service
// account (Content Manager) on the company Shared Drive - GOOGLE_DRIVE_CREDENTIALS (inline JSON) or
// GOOGLE_DRIVE_KEY_FILE, plus GOOGLE_DRIVE_SHARED_DRIVE_ID.

export const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder"
export const REPOSITORY_STORAGE_KEY = "REPOSITORY_STORAGE"

export type DriveMode = "account" | "shared"

interface DriveCtx {
  mode: DriveMode
  drive: drive_v3.Drive
  /** Shared mode only. */
  sharedDriveId: string | null
}

interface DriveCompany {
  tenantId: string
  slug: string
  /** The dev-machine test company, whose files go to "DNMS (test)". */
  test: boolean
}

/**
 * Drive is Digitally Next's own account, so only the founding company uses it - plus, on a dev
 * machine, the company named in GOOGLE_DRIVE_TEST_TENANT. In a request the company comes from the
 * headers proxy.ts stamps (as for the DB guard); platform jobs and public routes have none and act
 * for the founding company.
 */
export async function driveCompany(): Promise<DriveCompany | null> {
  const t = currentTenant() ?? (await tenantFromRequestHeaders())
  if (!t || t.tenantId === FOUNDING_TENANT_ID) {
    return { tenantId: FOUNDING_TENANT_ID, slug: FOUNDING_TENANT_SLUG, test: false }
  }
  const testSlug = process.env.GOOGLE_DRIVE_TEST_TENANT
  if (testSlug && t.slug === testSlug) return { tenantId: t.tenantId, slug: t.slug, test: true }
  return null
}

async function readCredentials(): Promise<{ client_email: string; private_key: string } | null> {
  const inline = await getConfig("GOOGLE_DRIVE_CREDENTIALS")
  if (inline) {
    try {
      const j = JSON.parse(inline)
      if (j.client_email && j.private_key) return j
    } catch {
      /* fall through */
    }
  }
  const path = await getConfig("GOOGLE_DRIVE_KEY_FILE")
  if (path) {
    try {
      const j = JSON.parse(readFileSync(path, "utf8"))
      if (j.client_email && j.private_key) return j
    } catch {
      /* fall through */
    }
  }
  return null
}

export async function isSharedDriveConfigured(): Promise<boolean> {
  return sharedConfigured()
}

async function sharedConfigured(): Promise<boolean> {
  const [creds, driveId] = await Promise.all([
    readCredentials(),
    getConfig("GOOGLE_DRIVE_SHARED_DRIVE_ID"),
  ])
  return !!creds && !!driveId
}

let sharedCached: DriveCtx | null = null

async function sharedCtx(): Promise<DriveCtx | null> {
  if (sharedCached) return sharedCached
  const creds = await readCredentials()
  const sharedDriveId = await getConfig("GOOGLE_DRIVE_SHARED_DRIVE_ID")
  if (!creds || !sharedDriveId) return null
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  })
  sharedCached = { mode: "shared", drive: google.drive({ version: "v3", auth }), sharedDriveId }
  return sharedCached
}

async function accountCtx(): Promise<DriveCtx | null> {
  const drive = await connectedDrive()
  return drive ? { mode: "account", drive, sharedDriveId: null } : null
}

/** Which Drive this company's Repository writes to; null = no Drive here. */
export async function activeDriveMode(): Promise<DriveMode | null> {
  const company = await driveCompany()
  if (!company) return null
  const connected = await isDriveAccountConnected()
  if (company.test) return connected ? "account" : null
  if (connected && (await getConfig(REPOSITORY_STORAGE_KEY)) === "drive") return "account"
  return (await sharedConfigured()) ? "shared" : null
}

export async function isDriveConfigured(): Promise<boolean> {
  return (await activeDriveMode()) !== null
}

async function activeCtx(): Promise<DriveCtx> {
  const mode = await activeDriveMode()
  if (!mode) {
    throw new Error(
      (await driveCompany())
        ? "Google Drive is not configured"
        : "Google Drive is not available for this workspace",
    )
  }
  const ctx = mode === "account" ? await accountCtx() : await sharedCtx()
  if (!ctx) throw new Error("Google Drive is not configured")
  return ctx
}

/** Active Drive first, then the other: a file keeps living in the Drive it was made in. */
async function byIdCtxs(): Promise<DriveCtx[]> {
  const company = await driveCompany()
  if (!company) throw new Error("Google Drive is not available for this workspace")
  const active = await activeDriveMode()
  const order: DriveMode[] = company.test
    ? ["account"]
    : active === "shared"
      ? ["shared", "account"]
      : ["account", "shared"]
  const out: DriveCtx[] = []
  for (const m of order) {
    const ctx = m === "account" ? await accountCtx() : await sharedCtx()
    if (ctx) out.push(ctx)
  }
  if (out.length === 0) throw new Error("Google Drive is not configured")
  return out
}

export function isDriveNotFound(error: unknown): boolean {
  const e = error as { code?: number | string; status?: number; response?: { status?: number } }
  return e?.code === 404 || e?.status === 404 || e?.response?.status === 404
}

/** Each Drive answers 404 for files it can't see, so a miss in one tries the next. */
async function onFile<T>(fn: (ctx: DriveCtx) => Promise<T>): Promise<T> {
  let miss: unknown = null
  for (const ctx of await byIdCtxs()) {
    try {
      return await fn(ctx)
    } catch (e) {
      if (!isDriveNotFound(e)) throw e
      miss = e
    }
  }
  throw miss
}

// Every Shared Drive call needs this flag; it is harmless on a normal Drive.
const SD = { supportsAllDrives: true } as const
const SD_LIST = { supportsAllDrives: true, includeItemsFromAllDrives: true } as const

function listScope(ctx: DriveCtx) {
  return ctx.mode === "shared"
    ? { corpora: "drive", driveId: ctx.sharedDriveId!, ...SD_LIST }
    : { ...SD_LIST }
}

/**
 * Items made in the account's Drive carry their company (so backups can find them) and can't be
 * re-shared by editors: sharing goes through DNMS.
 */
async function createExtras(ctx: DriveCtx, tags: Record<string, string> = {}) {
  if (ctx.mode === "shared") return Object.keys(tags).length ? { appProperties: tags } : {}
  const company = await driveCompany()
  return {
    appProperties: { ...(company ? { dnmsTenant: company.tenantId } : {}), ...tags },
    writersCanShare: false,
  }
}

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  size: number | null
  webViewLink: string | null
  iconLink: string | null
  /** Short-lived preview image. */
  thumbnailLink: string | null
  modifiedTime: string | null
  modifiedBy: string | null
  /** Exactly one parent inside a Shared Drive. */
  parentId: string | null
  isFolder: boolean
  /** Binary files only; Google Docs/Sheets have none. */
  md5: string | null
  appProperties: Record<string, string> | null
}

function toFile(f: drive_v3.Schema$File): DriveFile {
  return {
    id: f.id!,
    name: f.name ?? "",
    mimeType: f.mimeType ?? "",
    size: f.size ? Number(f.size) : null,
    webViewLink: f.webViewLink ?? null,
    iconLink: f.iconLink ?? null,
    thumbnailLink: f.thumbnailLink ?? null,
    modifiedTime: f.modifiedTime ?? null,
    modifiedBy: f.lastModifyingUser?.displayName ?? null,
    parentId: f.parents?.[0] ?? null,
    isFolder: f.mimeType === DRIVE_FOLDER_MIME,
    md5: f.md5Checksum ?? null,
    appProperties: (f.appProperties as Record<string, string> | null | undefined) ?? null,
  }
}

const FILE_FIELDS =
  "id,name,mimeType,size,webViewLink,iconLink,thumbnailLink,modifiedTime,parents,lastModifyingUser(displayName),md5Checksum,appProperties"

// One root per company; concurrent first uses share a single creation.
const rootLocks = new Map<string, Promise<string>>()
const rootCache = new Map<string, { id: string; at: number }>()
const ROOT_TTL_MS = 10 * 60_000

/** Where project folders live: the Shared Drive itself, or this company's "DNMS" folder. */
async function rootFolderId(ctx: DriveCtx): Promise<string> {
  if (ctx.mode === "shared") return ctx.sharedDriveId!
  const company = await driveCompany()
  if (!company) throw new Error("Google Drive is not available for this workspace")
  const hit = rootCache.get(company.tenantId)
  if (hit && Date.now() - hit.at < ROOT_TTL_MS) return hit.id
  const pending = rootLocks.get(company.tenantId)
  if (pending) return pending

  const run = (async () => {
    const found = await ctx.drive.files.list({
      q: `appProperties has { key='dnmsRoot' and value='${company.tenantId}' } and mimeType='${DRIVE_FOLDER_MIME}' and trashed=false`,
      orderBy: "createdTime", // oldest first
      fields: "files(id)",
      pageSize: 5,
    })
    let id = found.data.files?.[0]?.id
    if (!id) {
      const created = await ctx.drive.files.create({
        requestBody: {
          name: company.test ? "DNMS (test)" : "DNMS",
          mimeType: DRIVE_FOLDER_MIME,
          ...(await createExtras(ctx, { dnmsRoot: company.tenantId })),
        },
        fields: "id",
      })
      id = created.data.id!
    }
    rootCache.set(company.tenantId, { id, at: Date.now() })
    return id
  })()
  rootLocks.set(company.tenantId, run)
  try {
    return await run
  } finally {
    rootLocks.delete(company.tenantId)
  }
}

/** The company's "DNMS" folder in the connected account, for "Open in Drive". Never creates it. */
export async function accountRootFolder(): Promise<{ id: string; link: string } | null> {
  const ctx = await accountCtx()
  const company = await driveCompany()
  if (!ctx || !company) return null
  const found = await ctx.drive.files.list({
    q: `appProperties has { key='dnmsRoot' and value='${company.tenantId}' } and mimeType='${DRIVE_FOLDER_MIME}' and trashed=false`,
    orderBy: "createdTime",
    fields: "files(id,webViewLink)",
    pageSize: 1,
  })
  const f = found.data.files?.[0]
  return f?.id ? { id: f.id, link: f.webViewLink ?? driveFolderUrl(f.id) } : null
}

export function driveFolderUrl(id: string): string {
  return `https://drive.google.com/drive/folders/${id}`
}

// So concurrent calls for one project share a single folder creation.
const ensureLocks = new Map<string, Promise<DriveFile>>()

/**
 * Found project folders, per Drive client (a reconnected account gets a new client, so a new
 * cache). The search costs ~0.5-1s and every Repository read starts with it; a folder id doesn't
 * change, and the TTL still lets duplicate-healing and a trashed root be noticed.
 */
const PROJECT_FOLDER_TTL_MS = 30 * 60_000
const projectFolderCache = new WeakMap<object, Map<string, { file: DriveFile; at: number }>>()

/**
 * Find the folder tagged with this projectId (appProperties) or create it. files.list is eventually
 * consistent, so duplicates are also healed on read: the oldest is kept, the rest trashed.
 */
export async function ensureFolderForProject(
  projectId: string,
  folderName: string,
): Promise<DriveFile> {
  const ctx = await activeCtx()
  let cache = projectFolderCache.get(ctx.drive)
  if (!cache) {
    cache = new Map()
    projectFolderCache.set(ctx.drive, cache)
  }
  const hit = cache.get(projectId)
  if (hit && Date.now() - hit.at < PROJECT_FOLDER_TTL_MS) return hit.file

  const lockKey = `${ctx.mode}:${projectId}`
  const existing = ensureLocks.get(lockKey)
  if (existing) return existing

  const run = (async (): Promise<DriveFile> => {
    const found = await ctx.drive.files.list({
      ...listScope(ctx),
      q: `appProperties has { key='dnmsProjectId' and value='${projectId}' } and mimeType='${DRIVE_FOLDER_MIME}' and trashed=false`,
      orderBy: "createdTime", // oldest first
      fields: `files(${FILE_FIELDS})`,
    })
    const files = found.data.files ?? []
    if (files.length > 0) {
      for (const dup of files.slice(1)) {
        await ctx.drive.files
          .update({ fileId: dup.id!, ...SD, requestBody: { trashed: true } })
          .catch(() => {})
      }
      return toFile(files[0]!)
    }

    const created = await ctx.drive.files.create({
      ...SD,
      requestBody: {
        name: folderName,
        mimeType: DRIVE_FOLDER_MIME,
        parents: [await rootFolderId(ctx)],
        ...(await createExtras(ctx, { dnmsProjectId: projectId })),
      },
      fields: FILE_FIELDS,
    })
    return toFile(created.data)
  })()

  ensureLocks.set(lockKey, run)
  try {
    const file = await run
    cache.set(projectId, { file, at: Date.now() })
    return file
  } finally {
    ensureLocks.delete(lockKey)
  }
}

/** Non-recursive; folders first, then by modified. */
export async function listFolder(folderId: string): Promise<DriveFile[]> {
  const ctx = await activeCtx()
  const res = await ctx.drive.files.list({
    ...listScope(ctx),
    q: `'${folderId}' in parents and trashed=false`,
    orderBy: "folder,modifiedTime desc",
    fields: `files(${FILE_FIELDS})`,
    pageSize: 200,
  })
  return (res.data.files ?? []).map(toFile)
}

/**
 * Files (not folders) directly in any of `folderIds` whose name contains `text`. Drive has no
 * recursive search, so the caller passes every folder of the tree; they go in batches because
 * Drive caps a query's length.
 */
export async function searchFolders(folderIds: string[], text: string): Promise<DriveFile[]> {
  if (folderIds.length === 0 || !text.trim()) return []
  const ctx = await activeCtx()
  const needle = text.trim().replace(/\\/g, "\\\\").replace(/'/g, "\\'")
  const out: DriveFile[] = []
  for (let i = 0; i < folderIds.length; i += 20) {
    const parents = folderIds
      .slice(i, i + 20)
      .map((id) => `'${id}' in parents`)
      .join(" or ")
    const res = await ctx.drive.files.list({
      ...listScope(ctx),
      q: `(${parents}) and name contains '${needle}' and mimeType != '${DRIVE_FOLDER_MIME}' and trashed=false`,
      fields: `files(${FILE_FIELDS})`,
      pageSize: 200,
    })
    out.push(...(res.data.files ?? []).map(toFile))
  }
  return out
}

export async function uploadToFolder(
  folderId: string,
  name: string,
  mimeType: string,
  body: Buffer | NodeJS.ReadableStream,
  tags?: Record<string, string>,
): Promise<DriveFile> {
  const ctx = await activeCtx()
  const { Readable } = await import("stream")
  const res = await ctx.drive.files.create({
    ...SD,
    requestBody: { name, parents: [folderId], ...(await createExtras(ctx, tags)) },
    media: { mimeType, body: Buffer.isBuffer(body) ? Readable.from(body) : body },
    fields: FILE_FIELDS,
  })
  return toFile(res.data)
}

export async function createGoogleFile(
  folderId: string,
  name: string,
  kind: "doc" | "sheet",
  tags?: Record<string, string>,
): Promise<DriveFile> {
  const ctx = await activeCtx()
  const mimeType =
    kind === "sheet"
      ? "application/vnd.google-apps.spreadsheet"
      : "application/vnd.google-apps.document"
  const res = await ctx.drive.files.create({
    ...SD,
    requestBody: { name, mimeType, parents: [folderId], ...(await createExtras(ctx, tags)) },
    fields: FILE_FIELDS,
  })
  return toFile(res.data)
}

/** Export a Google-native file (e.g. a Sheet as .xlsx, keeping every tab). Drive caps exports at 10 MB. */
export async function exportDriveFile(fileId: string, mimeType: string): Promise<Buffer> {
  return onFile(async ({ drive }) => {
    const res = await drive.files.export({ fileId, mimeType }, { responseType: "arraybuffer" })
    return Buffer.from(res.data as ArrayBuffer)
  })
}

/** The file's bytes, for copies (backups, the move to Drive). Not for native Docs - export those. */
export async function downloadDriveFile(fileId: string): Promise<Buffer> {
  return onFile(async ({ drive }) => {
    const res = await drive.files.get(
      { fileId, alt: "media", ...SD },
      { responseType: "arraybuffer" },
    )
    return Buffer.from(res.data as ArrayBuffer)
  })
}

/** Trash only: recoverable from Drive for 30 days (and a Content Manager can't hard-delete). */
export async function trashDriveFile(fileId: string): Promise<void> {
  await onFile(({ drive }) => drive.files.update({ fileId, ...SD, requestBody: { trashed: true } }))
}

export async function createDriveFolder(
  parentId: string,
  name: string,
  tags?: Record<string, string>,
): Promise<DriveFile> {
  const ctx = await activeCtx()
  const res = await ctx.drive.files.create({
    ...SD,
    requestBody: {
      name,
      mimeType: DRIVE_FOLDER_MIME,
      parents: [parentId],
      ...(await createExtras(ctx, tags)),
    },
    fields: FILE_FIELDS,
  })
  return toFile(res.data)
}

export async function renameDriveFile(fileId: string, name: string): Promise<DriveFile> {
  return onFile(async ({ drive }) => {
    const res = await drive.files.update({
      fileId,
      ...SD,
      requestBody: { name },
      fields: FILE_FIELDS,
    })
    return toFile(res.data)
  })
}

/** Re-parent a file/folder. Drive needs the old parent named explicitly. */
export async function moveDriveFile(
  fileId: string,
  fromParentId: string,
  toParentId: string,
): Promise<DriveFile> {
  return onFile(async ({ drive }) => {
    const res = await drive.files.update({
      fileId,
      ...SD,
      addParents: toParentId,
      removeParents: fromParentId,
      fields: FILE_FIELDS,
    })
    return toFile(res.data)
  })
}

/** Null when gone, trashed or not visible. */
export async function getDriveFile(fileId: string): Promise<DriveFile | null> {
  try {
    return await onFile(async ({ drive }) => {
      const res = await drive.files.get({ fileId, ...SD, fields: `${FILE_FIELDS},trashed` })
      return res.data.trashed ? null : toFile(res.data)
    })
  } catch (e) {
    if (isDriveNotFound(e)) return null
    throw e
  }
}

/**
 * Ownership check behind every Drive write: the service account sees every project, so without it
 * one project's member could edit another project's files by id.
 */
export async function isUnderFolder(fileId: string, rootId: string): Promise<boolean> {
  if (fileId === rootId) return true
  let current: string | null = fileId
  for (let depth = 0; depth < 25 && current; depth++) {
    const f = await getDriveFile(current)
    if (!f) return false
    if (f.parentId === rootId) return true
    current = f.parentId
  }
  return false
}

export interface DrivePermission {
  id: string
  email: string | null
  role: string
  type: string
}

export async function listPermissions(fileId: string): Promise<DrivePermission[]> {
  return onFile(async ({ drive }) => {
    const res = await drive.permissions.list({
      fileId,
      ...SD,
      fields: "permissions(id,emailAddress,role,type)",
    })
    return (res.data.permissions ?? []).map((p) => ({
      id: p.id!,
      email: p.emailAddress ?? null,
      role: p.role ?? "",
      type: p.type ?? "",
    }))
  })
}

export async function grantAccess(
  fileId: string,
  email: string,
  role: "reader" | "writer" = "writer",
): Promise<void> {
  await onFile(({ drive }) =>
    drive.permissions.create({
      fileId,
      ...SD,
      sendNotificationEmail: false,
      requestBody: { role, type: "user", emailAddress: email },
    }),
  )
}

export async function revokeAccess(fileId: string, permissionId: string): Promise<void> {
  await onFile(({ drive }) => drive.permissions.delete({ fileId, permissionId, ...SD }))
}

/** Remove any "anyone with the link" permission someone added by hand in Drive. No-op if none. */
export async function revokeAnyoneAccess(fileId: string): Promise<void> {
  const perms = await listPermissions(fileId)
  for (const p of perms.filter((p) => p.type === "anyone")) {
    await revokeAccess(fileId, p.id).catch(() => {})
  }
}

export interface DriveStream {
  /** 200, or 206 when the caller sent a Range header Drive honoured. */
  status: number
  body: NodeJS.ReadableStream
  contentType: string
  contentLength: string | null
  /** Present on a 206; the browser needs it verbatim to seek. */
  contentRange: string | null
}

/** `range` passes straight to Drive and its status/Content-Range come straight back, so <video> seeking works. */
export async function streamDriveFile(fileId: string, range?: string | null): Promise<DriveStream> {
  return onFile(async ({ drive }) => {
    const res = await drive.files.get(
      { fileId, alt: "media", ...SD },
      { responseType: "stream", headers: range ? { Range: range } : {} },
    )
    return {
      status: res.status === 206 ? 206 : 200,
      body: res.data as unknown as NodeJS.ReadableStream,
      contentType: header(res.headers, "content-type") ?? "application/octet-stream",
      contentLength: header(res.headers, "content-length"),
      contentRange: header(res.headers, "content-range"),
    }
  })
}

/**
 * googleapis returns a Headers-like object: indexing gives undefined but .get() works (older versions
 * gave a plain object), so try both. Getting this wrong silently breaks video seeking.
 */
function header(h: unknown, name: string): string | null {
  if (h && typeof (h as Headers).get === "function") {
    return (h as Headers).get(name)
  }
  return (h as Record<string, string | undefined>)?.[name] ?? null
}

export interface DriveAbout {
  email: string | null
  name: string | null
  photo: string | null
  /** Null on an unlimited plan. */
  limit: number | null
  /** Drive + Gmail + Photos. */
  usage: number
  usageInDrive: number
  usageInDriveTrash: number
}

/** The connected account and its storage quota; null when no account is connected. */
export async function driveAccountAbout(): Promise<DriveAbout | null> {
  const ctx = await accountCtx()
  if (!ctx) return null
  const res = await ctx.drive.about.get({
    fields: "user(displayName,emailAddress,photoLink),storageQuota",
  })
  const q = res.data.storageQuota ?? {}
  const n = (v: string | null | undefined) => (v ? Number(v) : 0)
  return {
    email: res.data.user?.emailAddress ?? null,
    name: res.data.user?.displayName ?? null,
    photo: res.data.user?.photoLink ?? null,
    limit: q.limit ? Number(q.limit) : null,
    usage: n(q.usage),
    usageInDrive: n(q.usageInDrive),
    usageInDriveTrash: n(q.usageInDriveTrash),
  }
}

/** Every file (not folder) DNMS made for this company in the account's Drive, for the backup. */
export async function listCompanyDriveFiles(): Promise<DriveFile[]> {
  const ctx = await accountCtx()
  const company = await driveCompany()
  if (!ctx || !company) return []
  const out: DriveFile[] = []
  let pageToken: string | undefined
  do {
    const res = await ctx.drive.files.list({
      q: `appProperties has { key='dnmsTenant' and value='${company.tenantId}' } and mimeType!='${DRIVE_FOLDER_MIME}' and trashed=false`,
      fields: `nextPageToken,files(${FILE_FIELDS})`,
      pageSize: 1000,
      pageToken,
    })
    out.push(...(res.data.files ?? []).map(toFile))
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)
  return out
}

/** A file in the connected account only (null when that account can't see it). */
export async function getAccountFile(fileId: string): Promise<DriveFile | null> {
  const ctx = await accountCtx()
  if (!ctx) return null
  try {
    const res = await ctx.drive.files.get({ fileId, fields: `${FILE_FIELDS},trashed` })
    return res.data.trashed ? null : toFile(res.data)
  } catch (e) {
    if (isDriveNotFound(e)) return null
    throw e
  }
}

/** A file DNMS tagged earlier, e.g. a half-finished move found again on a re-run. */
export async function findAccountFileByTag(key: string, value: string): Promise<DriveFile | null> {
  const ctx = await accountCtx()
  if (!ctx) return null
  const res = await ctx.drive.files.list({
    q: `appProperties has { key='${key}' and value='${value}' } and trashed=false`,
    orderBy: "createdTime",
    fields: `files(${FILE_FIELDS})`,
    pageSize: 1,
  })
  const f = res.data.files?.[0]
  return f ? toFile(f) : null
}

/** One folder of the connected account's DNMS tree, for the Storage page browser. */
export async function listAccountFolder(folderId: string): Promise<DriveFile[]> {
  const ctx = await accountCtx()
  if (!ctx) return []
  const out: DriveFile[] = []
  let pageToken: string | undefined
  do {
    const res = await ctx.drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      orderBy: "folder,name",
      fields: `nextPageToken,files(${FILE_FIELDS})`,
      pageSize: 500,
      pageToken,
    })
    out.push(...(res.data.files ?? []).map(toFile))
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)
  return out
}

/** Everything in the old Shared Drive, for the move tool. Null when it isn't configured. */
export async function listSharedDriveItems(): Promise<{
  folders: DriveFile[]
  files: DriveFile[]
} | null> {
  // The Shared Drive is the founding company's alone.
  const company = await driveCompany()
  if (!company || company.test) return null
  const ctx = await sharedCtx()
  if (!ctx) return null
  const folders: DriveFile[] = []
  const files: DriveFile[] = []
  let pageToken: string | undefined
  do {
    const res = await ctx.drive.files.list({
      ...listScope(ctx),
      q: "trashed=false",
      fields: `nextPageToken,files(${FILE_FIELDS})`,
      pageSize: 1000,
      pageToken,
    })
    for (const f of (res.data.files ?? []).map(toFile)) (f.isFolder ? folders : files).push(f)
    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)
  return { folders, files }
}
