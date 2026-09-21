import { isBlockedHostname } from '@pinshelf/shared'
import { and, eq, isNull, lt, or } from 'drizzle-orm'
import { db } from '~/db/index.server'
import { bookmarks } from '~/db/schema'

const TIMEOUT_MS = 8000
const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000
const LIMIT = 10

const USER_AGENT = 'Mozilla/5.0 (compatible; pinshelf/0.1; +https://app.pinshelf.app)'

export type LinkStatus = 'unknown' | 'ok' | 'broken'

/**
 * Checks the oldest-checked active bookmarks and records whether the link still
 * answers. HEAD keeps it cheap; a 405 means the server dislikes HEAD rather
 * than the page being gone, so that counts as ok. Blocked hostnames are left
 * unknown instead of being reported as broken.
 */
export async function checkStaleLinks(limit = LIMIT): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS)
  const rows = await db
    .select({ id: bookmarks.id, url: bookmarks.url })
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.status, 'active'),
        or(isNull(bookmarks.linkCheckedAt), lt(bookmarks.linkCheckedAt, cutoff)),
      ),
    )
    .limit(limit)

  let checked = 0
  for (const row of rows) {
    let status: LinkStatus = 'unknown'

    try {
      const url = new URL(row.url)
      if (!isBlockedHostname(url.hostname)) {
        const response = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
          headers: { 'user-agent': USER_AGENT },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
        status = response.ok || response.status === 405 ? 'ok' : 'broken'
      }
    } catch {
      status = 'broken'
    }

    await db
      .update(bookmarks)
      .set({ linkStatus: status, linkCheckedAt: new Date() })
      .where(eq(bookmarks.id, row.id))
    checked++
  }

  return checked
}
