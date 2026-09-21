import { eq } from 'drizzle-orm'
import { env } from 'cloudflare:workers'
import { db } from '~/db/index.server'
import { settings } from '~/db/schema'
import { exportBookmarksJson, importBookmarks } from '~/lib/import-export.server'
import type { ImportSummary } from '~/lib/import-export.server'

const PREFIX = 'backups/'
const MAX_BACKUPS = 30
const SETTINGS_ID = 'default'
const MIN_RETENTION = 1
const MAX_RETENTION = 365

/** Retention is a setting; the constant is only the fallback. */
export async function getBackupRetention(): Promise<number> {
  const [row] = await db
    .select({ retention: settings.backupRetention })
    .from(settings)
    .where(eq(settings.id, SETTINGS_ID))
    .limit(1)
  return row?.retention ?? MAX_BACKUPS
}

export async function setBackupRetention(days: number): Promise<number> {
  const clean = Math.round(days)
  if (!Number.isFinite(clean) || clean < MIN_RETENTION || clean > MAX_RETENTION) {
    throw new Error(
      `Keep between ${MIN_RETENTION} and ${MAX_RETENTION} backups, not ${days}`,
    )
  }

  const now = new Date()
  await db
    .insert(settings)
    .values({ id: SETTINGS_ID, backupRetention: clean, updatedAt: now })
    .onConflictDoUpdate({
      target: settings.id,
      set: { backupRetention: clean, updatedAt: now },
    })
  return clean
}

export type BackupSummary = {
  key: string
  size: number
  uploaded: string
}

export type BackupTrigger = 'manual' | 'cron'

/** Backup keys come from the client, so they are validated before use. */
function assertBackupKey(key: string): void {
  if (!key.startsWith(PREFIX) || key.includes('..') || key.length > 200) {
    throw new Error('Invalid backup key')
  }
}

function toSummary(object: R2Object): BackupSummary {
  return {
    key: object.key,
    size: object.size,
    uploaded: object.uploaded.toISOString(),
  }
}

export async function createBackup(trigger: BackupTrigger): Promise<BackupSummary> {
  const contents = await exportBookmarksJson()
  const key = `${PREFIX}${new Date().toISOString().replace(/[:.]/g, '-')}.json`

  const object = await env.BACKUPS.put(key, contents, {
    httpMetadata: { contentType: 'application/json' },
    customMetadata: { trigger },
  })

  await pruneBackups(await getBackupRetention())

  return {
    key,
    size: object?.size ?? contents.length,
    uploaded: (object?.uploaded ?? new Date()).toISOString(),
  }
}

export async function listBackups(): Promise<BackupSummary[]> {
  const listed = await env.BACKUPS.list({ prefix: PREFIX, limit: 1000 })
  return listed.objects
    .map(toSummary)
    .sort((a, b) => b.uploaded.localeCompare(a.uploaded))
}

export async function readBackup(key: string): Promise<string> {
  assertBackupKey(key)
  const object = await env.BACKUPS.get(key)
  if (!object) throw new Error('Backup not found')
  return object.text()
}

export async function deleteBackup(key: string): Promise<void> {
  assertBackupKey(key)
  await env.BACKUPS.delete(key)
}

/** Adds whatever is missing from the backup. Existing bookmarks are untouched. */
export async function restoreBackup(key: string): Promise<ImportSummary> {
  const contents = await readBackup(key)
  return importBookmarks(contents, key)
}

/** Keeps the newest `keep` backups and deletes the rest. */
export async function pruneBackups(keep = MAX_BACKUPS): Promise<number> {
  const backups = await listBackups()
  const stale = backups.slice(keep)
  for (const backup of stale) {
    await env.BACKUPS.delete(backup.key)
  }
  return stale.length
}

/** Body of the daily cron trigger; see apps/web/src/server.ts. */
export async function runScheduledBackup(): Promise<BackupSummary> {
  return createBackup('cron')
}
