import { and, count, desc, eq, sql } from 'drizzle-orm'
import { db } from '~/db/index.server'
import { bookmarkTags, bookmarks, tags } from '~/db/schema'

export type Insights = {
  counts: { active: number; archived: number; trashed: number; unsorted: number }
  upkeep: { brokenLinks: number; metadataFailed: number; archivedPages: number }
  perMonth: { month: string; saved: number }[]
  topHosts: { host: string; saved: number }[]
  topTags: { tag: string; saved: number }[]
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export async function getInsights(): Promise<Insights> {
  const [counts] = await db
    .select({
      active: sql<number>`sum(case when ${bookmarks.status} = 'active' then 1 else 0 end)`,
      archived: sql<number>`sum(case when ${bookmarks.status} = 'archived' then 1 else 0 end)`,
      trashed: sql<number>`sum(case when ${bookmarks.status} = 'trashed' then 1 else 0 end)`,
      unsorted: sql<number>`sum(case when ${bookmarks.status} = 'active' and ${bookmarks.collectionId} is null then 1 else 0 end)`,
      brokenLinks: sql<number>`sum(case when ${bookmarks.linkStatus} = 'broken' and ${bookmarks.status} = 'active' then 1 else 0 end)`,
      metadataFailed: sql<number>`sum(case when ${bookmarks.metadataStatus} = 'failed' then 1 else 0 end)`,
      archivedPages: sql<number>`sum(case when ${bookmarks.archiveStatus} = 'done' then 1 else 0 end)`,
    })
    .from(bookmarks)

  const months = await db.all<{ month: string; saved: number }>(sql`
    SELECT strftime('%Y-%m', ${bookmarks.createdAt}, 'unixepoch') AS month, count(*) AS saved
    FROM ${bookmarks}
    WHERE ${bookmarks.status} = 'active'
    GROUP BY month
    ORDER BY month DESC
    LIMIT 12
  `)

  // Hosts are not a column, so aggregate in code; a personal library fits.
  const rows = await db
    .select({ url: bookmarks.url })
    .from(bookmarks)
    .where(eq(bookmarks.status, 'active'))
  const hostCounts = new Map<string, number>()
  for (const row of rows) {
    const host = hostOf(row.url)
    hostCounts.set(host, (hostCounts.get(host) ?? 0) + 1)
  }
  const topHosts = [...hostCounts.entries()]
    .map(([host, saved]) => ({ host, saved }))
    .sort((a, b) => b.saved - a.saved)
    .slice(0, 10)

  const topTags = await db
    .select({ tag: tags.name, saved: count(bookmarkTags.bookmarkId) })
    .from(tags)
    .innerJoin(bookmarkTags, eq(bookmarkTags.tagId, tags.id))
    .innerJoin(
      bookmarks,
      and(eq(bookmarks.id, bookmarkTags.bookmarkId), eq(bookmarks.status, 'active')),
    )
    .groupBy(tags.id)
    .orderBy(desc(count(bookmarkTags.bookmarkId)))
    .limit(10)

  return {
    counts: {
      active: Number(counts?.active ?? 0),
      archived: Number(counts?.archived ?? 0),
      trashed: Number(counts?.trashed ?? 0),
      unsorted: Number(counts?.unsorted ?? 0),
    },
    upkeep: {
      brokenLinks: Number(counts?.brokenLinks ?? 0),
      metadataFailed: Number(counts?.metadataFailed ?? 0),
      archivedPages: Number(counts?.archivedPages ?? 0),
    },
    perMonth: months.map((row) => ({ month: row.month, saved: Number(row.saved) })),
    topHosts,
    topTags: topTags.map((row) => ({ tag: row.tag, saved: Number(row.saved) })),
  }
}
