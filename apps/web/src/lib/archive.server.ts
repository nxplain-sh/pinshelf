import { eq } from 'drizzle-orm'
import { env } from 'cloudflare:workers'
import { db } from '~/db/index.server'
import { bookmarks, settings } from '~/db/schema'
import { fetchHtml } from '~/lib/metadata.server'

// One snapshot per bookmark, capped so a huge page cannot fill the bucket.
const MAX_BYTES = 2 * 1024 * 1024

export type ArchiveResult = { status: 'done' | 'failed'; key: string | null }

function keyFor(id: string): string {
  return `archives/${id}.html`
}

async function markFailed(id: string): Promise<ArchiveResult> {
  await db
    .update(bookmarks)
    .set({ archiveStatus: 'failed', updatedAt: new Date() })
    .where(eq(bookmarks.id, id))
  return { status: 'failed', key: null }
}

/**
 * Fetches the page through the same SSRF-guarded fetch metadata uses, keeps the
 * HTML in R2, and records the key on the row. One snapshot per bookmark: a
 * second run overwrites the first.
 */
export async function archiveBookmarkPage(id: string): Promise<ArchiveResult> {
  const [bookmark] = await db
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.id, id))
    .limit(1)
  if (!bookmark) throw new Error('Bookmark not found')

  try {
    const response = await fetchHtml(bookmark.url)
    if (!response.ok) {
      await response.body?.cancel()
      return markFailed(id)
    }

    const html = (await response.text()).slice(0, MAX_BYTES)
    const key = keyFor(id)
    await env.BACKUPS.put(key, html, {
      httpMetadata: { contentType: 'text/html; charset=utf-8' },
    })
    await db
      .update(bookmarks)
      .set({
        archiveKey: key,
        archiveStatus: 'done',
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bookmarks.id, id))

    return { status: 'done', key }
  } catch {
    return markFailed(id)
  }
}

export async function readArchive(key: string) {
  return env.BACKUPS.get(key)
}

export async function deleteArchiveFor(id: string): Promise<void> {
  await env.BACKUPS.delete(keyFor(id))
}

export async function getAutoArchive(): Promise<boolean> {
  const [row] = await db
    .select({ autoArchive: settings.autoArchive })
    .from(settings)
    .where(eq(settings.id, 'default'))
    .limit(1)
  return row?.autoArchive ?? false
}

export async function setAutoArchive(enabled: boolean): Promise<boolean> {
  const now = new Date()
  await db
    .insert(settings)
    .values({ id: 'default', autoArchive: enabled, updatedAt: now })
    .onConflictDoUpdate({
      target: settings.id,
      set: { autoArchive: enabled, updatedAt: now },
    })
  return enabled
}
