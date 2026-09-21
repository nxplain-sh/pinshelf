import {
  buildFtsQuery,
  normalizeTagName,
  normalizeUrl,
  tagNameKey,
  urlHash,
} from '@pinshelf/shared'
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  like,
  lt,
  notExists,
  or,
  sql,
} from 'drizzle-orm'
import { db } from '~/db/index.server'
import { bookmarkTags, bookmarks, collections, tags } from '~/db/schema'
import type { Bookmark } from '~/db/schema'
import { ID_CHUNK, ROW_CHUNK, chunk } from '~/lib/db-utils'
import {
  archiveBookmarkPage,
  deleteArchiveFor,
  getAutoArchive,
} from '~/lib/archive.server'
import { fetchMetadata } from '~/lib/metadata.server'
import type {
  BookmarkFilters,
  BookmarkListItem,
  BookmarkStatus,
  BulkUpdateInput,
  CreateBookmarkInput,
  CreateBookmarkResult,
  UpdateBookmarkInput,
} from '~/lib/bookmarks.types'

export type {
  BookmarkFilters,
  BookmarkListItem,
  BookmarkStatus,
  BulkUpdateInput,
  CreateBookmarkInput,
  CreateBookmarkResult,
  UpdateBookmarkInput,
} from '~/lib/bookmarks.types'

const LIST_LIMIT = 200

/**
 * Relevance wins when a search term is present: `queryBookmarks` reorders by
 * bm25 afterwards, so the sort only applies to unfiltered browsing.
 */
function orderFor(sort: BookmarkFilters['sort']) {
  switch (sort) {
    case 'oldest':
      return [asc(bookmarks.createdAt)] as const
    case 'title-asc':
      return [
        sql`${bookmarks.title} IS NULL`,
        sql`${bookmarks.title} COLLATE NOCASE`,
      ] as const
    case 'title-desc':
      return [
        sql`${bookmarks.title} IS NULL`,
        sql`${bookmarks.title} COLLATE NOCASE DESC`,
      ] as const
    case 'manual':
      // Bookmarks that were never rearranged have no index and sort to the
      // top, so a fresh save is visible until the order is set.
      return [
        sql`${bookmarks.sortIndex} IS NULL DESC`,
        asc(bookmarks.sortIndex),
        desc(bookmarks.createdAt),
      ] as const
    default:
      return [desc(bookmarks.createdAt)] as const
  }
}

function cleanTags(names: string[]): { name: string; nameKey: string }[] {
  const byKey = new Map<string, string>()
  for (const raw of names) {
    const name = normalizeTagName(raw)
    if (!name) continue
    const key = tagNameKey(name)
    if (!byKey.has(key)) byKey.set(key, name)
  }
  return [...byKey].map(([nameKey, name]) => ({ name, nameKey }))
}

export async function queryBookmarks(
  filters: BookmarkFilters,
): Promise<BookmarkListItem[]> {
  const conditions = [eq(bookmarks.status, filters.status)]

  if (filters.url) {
    try {
      conditions.push(eq(bookmarks.urlHash, await urlHash(normalizeUrl(filters.url))))
    } catch {
      return []
    }
  }

  if (filters.host) {
    const host = filters.host
      .trim()
      .toLowerCase()
      .replace(/^www\./, '')
    const hostMatch = or(
      like(bookmarks.url, `https://${host}/%`),
      like(bookmarks.url, `http://${host}/%`),
    )
    if (hostMatch) conditions.push(hostMatch)
  }

  if (filters.collection === 'unsorted') {
    conditions.push(isNull(bookmarks.collectionId))
  } else if (filters.collection) {
    conditions.push(eq(bookmarks.collectionId, filters.collection))
  }

  if (filters.tag) {
    const tagged = db
      .select({ id: bookmarkTags.bookmarkId })
      .from(bookmarkTags)
      .innerJoin(tags, eq(tags.id, bookmarkTags.tagId))
      .where(eq(tags.nameKey, tagNameKey(filters.tag)))
    conditions.push(inArray(bookmarks.id, tagged))
  }

  let rankedIds: string[] | null = null
  if (filters.q) {
    const match = buildFtsQuery(filters.q)
    if (!match) return []
    const hits = (await db.all(
      sql`SELECT bookmark_id FROM bookmarks_fts WHERE bookmarks_fts MATCH ${match} ORDER BY bm25(bookmarks_fts) LIMIT ${LIST_LIMIT}`,
    )) as { bookmark_id: string }[]
    rankedIds = hits.map((hit) => hit.bookmark_id)
    if (rankedIds.length === 0) return []
    conditions.push(inArray(bookmarks.id, rankedIds))
  }

  const rows = await db
    .select()
    .from(bookmarks)
    .where(and(...conditions))
    .orderBy(...orderFor(filters.sort))
    .limit(LIST_LIMIT)

  const ordered = rankedIds
    ? (() => {
        const byId = new Map(rows.map((row) => [row.id, row]))
        return rankedIds
          .map((id) => byId.get(id))
          .filter((row): row is Bookmark => row !== undefined)
      })()
    : rows

  const tagMap = await tagsFor(ordered.map((row) => row.id))
  const collectionIds = ordered
    .map((row) => row.collectionId)
    .filter((id): id is string => Boolean(id))
  const collectionNames = await collectionNamesFor(collectionIds)

  return ordered.map((row) => ({
    ...row,
    tags: tagMap.get(row.id) ?? [],
    collectionName: row.collectionId
      ? (collectionNames.get(row.collectionId) ?? null)
      : null,
  }))
}

export async function getBookmarkById(id: string): Promise<BookmarkListItem | null> {
  const [bookmark] = await db
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.id, id))
    .limit(1)
  if (!bookmark) return null

  const tagMap = await tagsFor([bookmark.id])
  const collectionName = bookmark.collectionId
    ? ((await collectionNamesFor([bookmark.collectionId])).get(bookmark.collectionId) ??
      null)
    : null

  return {
    ...bookmark,
    tags: tagMap.get(bookmark.id) ?? [],
    collectionName,
  }
}

export async function createBookmarkRecord(
  input: CreateBookmarkInput,
): Promise<CreateBookmarkResult> {
  let normalized: string
  try {
    normalized = normalizeUrl(input.url)
  } catch {
    return { bookmark: null, duplicate: false, error: 'Not a valid http(s) URL' }
  }

  const hash = await urlHash(normalized)
  const existing = await findByHash(hash)

  if (existing) {
    if (existing.status !== 'active') {
      const [restored] = await db
        .update(bookmarks)
        .set({ status: 'active', updatedAt: new Date() })
        .where(eq(bookmarks.id, existing.id))
        .returning()
      return { bookmark: restored, duplicate: true, error: null }
    }
    return { bookmark: existing, duplicate: true, error: null }
  }

  const now = new Date()
  let created: Bookmark
  try {
    const rows = await db
      .insert(bookmarks)
      .values({
        id: crypto.randomUUID(),
        url: normalized,
        urlHash: hash,
        collectionId: input.collectionId ?? null,
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    created = rows[0]
  } catch {
    const raced = await findByHash(hash)
    if (!raced) throw new Error('Failed to save bookmark')
    return { bookmark: raced, duplicate: true, error: null }
  }

  if (input.tags && input.tags.length > 0) {
    await replaceTags(created.id, input.tags)
  }

  const bookmark = await refreshMetadataFor(created)

  // Inline, like metadata (ADR-0006): a second request would need a queue, and
  // one snapshot per save is cheap at single-user volume.
  if (await getAutoArchive()) {
    await archiveBookmarkPage(created.id)
  }

  return { bookmark, duplicate: false, error: null }
}

export async function updateBookmarkRecord(
  input: UpdateBookmarkInput,
): Promise<Bookmark | null> {
  const patch: Partial<Bookmark> = { updatedAt: new Date() }
  if (input.title !== undefined) patch.title = input.title || null
  if (input.description !== undefined) patch.description = input.description || null
  if (input.notes !== undefined) patch.notes = input.notes || null
  if (input.collectionId !== undefined) patch.collectionId = input.collectionId

  const [updated] = await db
    .update(bookmarks)
    .set(patch)
    .where(eq(bookmarks.id, input.id))
    .returning()
  if (!updated) return null

  if (input.tags !== undefined) {
    await replaceTags(input.id, input.tags)
  }

  await reindexBookmarks([input.id])
  return updated
}

/** Writes the given order as spaced sort indexes (10, 20, 30, ...). */
export async function reorderBookmarksRecord(
  ids: string[],
): Promise<{ updated: number }> {
  const unique = [...new Set(ids)].slice(0, LIST_LIMIT)
  for (const [index, id] of unique.entries()) {
    await db
      .update(bookmarks)
      .set({ sortIndex: (index + 1) * 10, updatedAt: new Date() })
      .where(eq(bookmarks.id, id))
  }
  return { updated: unique.length }
}

export async function setBookmarkStatus(
  id: string,
  status: BookmarkStatus,
): Promise<Bookmark | null> {
  const [updated] = await db
    .update(bookmarks)
    .set({ status, updatedAt: new Date() })
    .where(eq(bookmarks.id, id))
    .returning()
  return updated ?? null
}

export async function deleteBookmarkRecord(id: string): Promise<void> {
  await db.delete(bookmarks).where(eq(bookmarks.id, id))
  await db.run(sql`DELETE FROM bookmarks_fts WHERE bookmark_id = ${id}`)
  await deleteArchiveFor(id)
  await pruneOrphanTags()
}

export async function refetchBookmarkMetadata(id: string): Promise<Bookmark | null> {
  const [bookmark] = await db
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.id, id))
    .limit(1)
  if (!bookmark) return null
  return refreshMetadataFor(bookmark)
}

export async function bulkUpdateRecords(
  input: BulkUpdateInput,
): Promise<{ updated: number }> {
  const ids = [...new Set(input.ids)].slice(0, LIST_LIMIT)
  if (ids.length === 0) return { updated: 0 }

  const patch: Partial<Bookmark> = { updatedAt: new Date() }
  if (input.collectionId !== undefined) patch.collectionId = input.collectionId
  if (input.status !== undefined) patch.status = input.status
  await db.update(bookmarks).set(patch).where(inArray(bookmarks.id, ids))

  const addTags = input.addTags ?? []
  if (addTags.length > 0) {
    const tagIds = await upsertTags(cleanTags(addTags))
    const rows = ids.flatMap((bookmarkId) =>
      tagIds.map((tagId) => ({ bookmarkId, tagId })),
    )
    for (const batch of chunk(rows, ROW_CHUNK)) {
      await db.insert(bookmarkTags).values(batch).onConflictDoNothing()
    }
  }

  const removeTags = input.removeTags ?? []
  if (removeTags.length > 0) {
    const keys = cleanTags(removeTags).map((tag) => tag.nameKey)
    const tagRows = keys.length
      ? await db.select({ id: tags.id }).from(tags).where(inArray(tags.nameKey, keys))
      : []
    if (tagRows.length > 0) {
      await db.delete(bookmarkTags).where(
        and(
          inArray(bookmarkTags.bookmarkId, ids),
          inArray(
            bookmarkTags.tagId,
            tagRows.map((row) => row.id),
          ),
        ),
      )
    }
  }

  await pruneOrphanTags()
  await reindexBookmarks(ids)
  return { updated: ids.length }
}

export async function tagsByBookmarkId(ids: string[]): Promise<Map<string, string[]>> {
  return tagsFor(ids)
}

const RETRY_ATTEMPTS = 3
const MAINTENANCE_LIMIT = 10

/** Retries metadata for rows that failed and still have attempts left. */
export async function retryFailedMetadata(limit = MAINTENANCE_LIMIT): Promise<number> {
  const rows = await db
    .select()
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.metadataStatus, 'failed'),
        lt(bookmarks.metadataAttempts, RETRY_ATTEMPTS),
      ),
    )
    .limit(limit)

  let retried = 0
  for (const row of rows) {
    try {
      await refreshMetadataFor(row)
      retried++
    } catch {
      // refreshMetadataFor records the failure itself; the next sweep picks it up.
    }
  }
  return retried
}

export type DuplicateGroup = {
  key: string
  items: BookmarkListItem[]
}

// Query strings and fragments often distinguish nothing (tracking parameters,
// anchors), so duplicates are judged on host plus path alone.
function duplicateKey(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.search = ''
    parsed.hash = ''
    parsed.pathname = parsed.pathname.replace(/\/+$/, '')
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname}`
  } catch {
    return url
  }
}

/** Active bookmarks whose urls differ only by query string, fragment, or slash. */
export async function findDuplicateGroups(limit = 50): Promise<DuplicateGroup[]> {
  const rows = await db.select().from(bookmarks).where(eq(bookmarks.status, 'active'))

  const grouped = new Map<string, Bookmark[]>()
  for (const row of rows) {
    const key = duplicateKey(row.url)
    grouped.set(key, [...(grouped.get(key) ?? []), row])
  }

  const duplicates = [...grouped.entries()]
    .filter(([, items]) => items.length > 1)
    .slice(0, limit)
  if (duplicates.length === 0) return []

  const tagMap = await tagsFor(
    duplicates.flatMap(([, items]) => items.map((row) => row.id)),
  )
  const collectionNames = await collectionNamesFor(
    duplicates.flatMap(([, items]) =>
      items.map((row) => row.collectionId).filter((id): id is string => Boolean(id)),
    ),
  )

  return duplicates.map(([key, items]) => ({
    key,
    items: items.map((row) => ({
      ...row,
      tags: tagMap.get(row.id) ?? [],
      collectionName: row.collectionId
        ? (collectionNames.get(row.collectionId) ?? null)
        : null,
    })),
  }))
}

async function tagsFor(ids: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  if (ids.length === 0) return map

  for (const batch of chunk(ids, ID_CHUNK)) {
    const rows = await db
      .select({ bookmarkId: bookmarkTags.bookmarkId, name: tags.name })
      .from(bookmarkTags)
      .innerJoin(tags, eq(tags.id, bookmarkTags.tagId))
      .where(inArray(bookmarkTags.bookmarkId, batch))
    for (const row of rows) {
      const list = map.get(row.bookmarkId) ?? []
      list.push(row.name)
      map.set(row.bookmarkId, list)
    }
  }

  for (const list of map.values()) {
    list.sort((a, b) => a.localeCompare(b))
  }
  return map
}

async function collectionNamesFor(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const unique = [...new Set(ids)]
  if (unique.length === 0) return map

  for (const batch of chunk(unique, ID_CHUNK)) {
    const rows = await db
      .select({ id: collections.id, name: collections.name })
      .from(collections)
      .where(inArray(collections.id, batch))
    for (const row of rows) map.set(row.id, row.name)
  }
  return map
}

async function upsertTags(
  cleaned: { name: string; nameKey: string }[],
): Promise<string[]> {
  if (cleaned.length === 0) return []

  const now = new Date()
  await db
    .insert(tags)
    .values(
      cleaned.map((tag) => ({
        id: crypto.randomUUID(),
        name: tag.name,
        nameKey: tag.nameKey,
        createdAt: now,
      })),
    )
    .onConflictDoNothing()

  const rows = await db
    .select({ id: tags.id })
    .from(tags)
    .where(
      inArray(
        tags.nameKey,
        cleaned.map((tag) => tag.nameKey),
      ),
    )
  return rows.map((row) => row.id)
}

async function replaceTags(bookmarkId: string, names: string[]): Promise<void> {
  const tagIds = await upsertTags(cleanTags(names))

  await db.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, bookmarkId))
  if (tagIds.length > 0) {
    await db
      .insert(bookmarkTags)
      .values(tagIds.map((tagId) => ({ bookmarkId, tagId })))
      .onConflictDoNothing()
  }
  await pruneOrphanTags()
}

async function pruneOrphanTags(): Promise<void> {
  await db.delete(tags).where(
    notExists(
      db
        .select({ one: sql`1` })
        .from(bookmarkTags)
        .where(eq(bookmarkTags.tagId, tags.id)),
    ),
  )
}

export async function reindexBookmarks(ids: string[]): Promise<void> {
  if (ids.length === 0) return

  for (const batch of chunk(ids, ID_CHUNK)) {
    const rows = await db.select().from(bookmarks).where(inArray(bookmarks.id, batch))
    const tagMap = await tagsFor(batch)

    await db.run(
      sql`DELETE FROM bookmarks_fts WHERE bookmark_id IN (${sql.join(
        batch.map((id) => sql`${id}`),
        sql`, `,
      )})`,
    )

    for (const rowsChunk of chunk(rows, 10)) {
      const values = rowsChunk.flatMap((row) => [
        sql`(${row.id}, ${row.title ?? ''}, ${row.description ?? ''}, ${row.notes ?? ''}, ${row.url}, ${(tagMap.get(row.id) ?? []).join(' ')})`,
      ])
      await db.run(
        sql`INSERT INTO bookmarks_fts (bookmark_id, title, description, notes, url, tags) VALUES ${sql.join(values, sql`, `)}`,
      )
    }
  }
}

async function findByHash(hash: string): Promise<Bookmark | undefined> {
  const [row] = await db
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.urlHash, hash))
    .limit(1)
  return row
}

async function refreshMetadataFor(bookmark: Bookmark): Promise<Bookmark> {
  const attempts = bookmark.metadataAttempts + 1
  try {
    const metadata = await fetchMetadata(bookmark.url)
    const [updated] = await db
      .update(bookmarks)
      .set({
        ...metadata,
        metadataStatus: 'done',
        metadataAttempts: attempts,
        updatedAt: new Date(),
      })
      .where(eq(bookmarks.id, bookmark.id))
      .returning()
    await reindexBookmarks([bookmark.id])
    return updated ?? bookmark
  } catch {
    const [updated] = await db
      .update(bookmarks)
      .set({
        metadataStatus: 'failed',
        metadataAttempts: attempts,
        updatedAt: new Date(),
      })
      .where(eq(bookmarks.id, bookmark.id))
      .returning()
    return updated ?? bookmark
  }
}
