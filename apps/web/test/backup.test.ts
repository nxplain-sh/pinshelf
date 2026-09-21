import { env } from 'cloudflare:workers'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createBackup,
  deleteBackup,
  listBackups,
  pruneBackups,
  readBackup,
  restoreBackup,
} from '../src/lib/backup.server'
import {
  createBookmarkRecord,
  deleteBookmarkRecord,
  queryBookmarks,
  setBookmarkStatus,
} from '../src/lib/bookmarks.server'

// Each test starts with an empty bucket; the tests share one R2 instance.
afterEach(async () => {
  const listed = await env.BACKUPS.list({ prefix: 'backups/' })
  for (const object of listed.objects) {
    await env.BACKUPS.delete(object.key)
  }
})

describe('r2 backups', () => {
  it('writes, lists, restores, and deletes', async () => {
    const created = await createBookmarkRecord({
      url: 'https://example.com/backup-one',
      tags: ['kept'],
      notes: 'survives the round trip',
    })
    expect(created.bookmark).not.toBeNull()

    const backup = await createBackup('manual')
    expect(backup.key.startsWith('backups/')).toBe(true)
    expect(backup.size).toBeGreaterThan(0)

    const listed = await listBackups()
    expect(listed).toHaveLength(1)
    expect(listed[0].key).toBe(backup.key)

    const contents = JSON.parse(await readBackup(backup.key)) as { version: number }
    expect(contents.version).toBe(1)

    await deleteBookmarkRecord(created.bookmark?.id as string)
    expect(await queryBookmarks({ status: 'active', q: 'backup one' })).toHaveLength(0)

    const restored = await restoreBackup(backup.key)
    expect(restored.imported).toBe(1)

    const rows = await queryBookmarks({ status: 'active', q: 'backup one' })
    expect(rows).toHaveLength(1)
    expect(rows[0].tags).toEqual(['kept'])
    expect(rows[0].notes).toBe('survives the round trip')

    await deleteBackup(backup.key)
    expect(await listBackups()).toHaveLength(0)
  })

  it('restores trashed bookmarks into the trash', async () => {
    const created = await createBookmarkRecord({
      url: 'https://example.com/backup-trashed',
    })
    await setBookmarkStatus(created.bookmark?.id as string, 'trashed')

    const backup = await createBackup('cron')
    await deleteBookmarkRecord(created.bookmark?.id as string)
    await restoreBackup(backup.key)

    const trashed = await queryBookmarks({ status: 'trashed' })
    expect(trashed.some((row) => row.url.endsWith('/backup-trashed'))).toBe(true)
  })

  it('keeps only the newest backups', async () => {
    await createBackup('manual')
    await new Promise((resolve) => setTimeout(resolve, 5))
    await createBackup('manual')
    await new Promise((resolve) => setTimeout(resolve, 5))
    await createBackup('manual')
    expect(await listBackups()).toHaveLength(3)

    expect(await pruneBackups(2)).toBe(1)
    expect(await listBackups()).toHaveLength(2)
  })

  it('refuses keys outside the backup prefix', async () => {
    await expect(readBackup('secrets.json')).rejects.toThrow('Invalid backup key')
    await expect(readBackup('backups/../secrets.json')).rejects.toThrow(
      'Invalid backup key',
    )
  })

  it('reports a missing backup instead of throwing something opaque', async () => {
    await expect(readBackup('backups/does-not-exist.json')).rejects.toThrow(
      'Backup not found',
    )
  })
})
