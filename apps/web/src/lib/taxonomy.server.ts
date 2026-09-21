import { normalizeTagName, tagNameKey } from '@pinshelf/shared'
import { and, asc, count, eq } from 'drizzle-orm'
import { db } from '~/db/index.server'
import { bookmarkTags, bookmarks, collections, tags } from '~/db/schema'
import { reindexBookmarks } from '~/lib/bookmarks.server'

export async function queryTags() {
  return db.select({ id: tags.id, name: tags.name }).from(tags).orderBy(asc(tags.nameKey))
}

export async function queryCollections() {
  return db
    .select({
      id: collections.id,
      name: collections.name,
      bookmarkCount: count(bookmarks.id),
    })
    .from(collections)
    .leftJoin(
      bookmarks,
      and(eq(bookmarks.collectionId, collections.id), eq(bookmarks.status, 'active')),
    )
    .groupBy(collections.id)
    .orderBy(asc(collections.nameKey))
}

/** Returns the existing collection with this name, creating it when missing. */
export async function ensureCollection(
  name: string,
): Promise<{ id: string; name: string; created: boolean }> {
  const clean = normalizeTagName(name)
  if (!clean) throw new Error('Collection name is required')
  const nameKey = tagNameKey(clean)

  const [existing] = await db
    .select({ id: collections.id, name: collections.name })
    .from(collections)
    .where(eq(collections.nameKey, nameKey))
    .limit(1)
  if (existing) return { ...existing, created: false }

  const now = new Date()
  const [created] = await db
    .insert(collections)
    .values({
      id: crypto.randomUUID(),
      name: clean,
      nameKey,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  return { id: created.id, name: created.name, created: true }
}

async function reindexTagged(tagId: string): Promise<void> {
  const rows = await db
    .select({ bookmarkId: bookmarkTags.bookmarkId })
    .from(bookmarkTags)
    .where(eq(bookmarkTags.tagId, tagId))
  await reindexBookmarks(rows.map((row) => row.bookmarkId))
}

/** Renames a tag. Fails when another tag already owns the new name. */
export async function renameTagRecord(
  id: string,
  name: string,
): Promise<{ id: string; name: string }> {
  const clean = normalizeTagName(name)
  if (!clean) throw new Error('Tag name is required')
  const nameKey = tagNameKey(clean)

  const [clash] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.nameKey, nameKey))
    .limit(1)
  if (clash && clash.id !== id) {
    throw new Error('Another tag already has that name — merge instead')
  }

  const [updated] = await db
    .update(tags)
    .set({ name: clean, nameKey })
    .where(eq(tags.id, id))
    .returning()
  if (!updated) throw new Error('Tag not found')

  await reindexTagged(id)
  return { id: updated.id, name: updated.name }
}

/** Moves every bookmark from one tag onto another and deletes the source. */
export async function mergeTagsRecord(
  fromId: string,
  intoId: string,
): Promise<{ moved: number }> {
  if (fromId === intoId) throw new Error('Pick two different tags')

  const [into] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.id, intoId))
    .limit(1)
  if (!into) throw new Error('Target tag not found')

  const rows = await db
    .select({ bookmarkId: bookmarkTags.bookmarkId })
    .from(bookmarkTags)
    .where(eq(bookmarkTags.tagId, fromId))

  if (rows.length > 0) {
    await db
      .insert(bookmarkTags)
      .values(rows.map((row) => ({ bookmarkId: row.bookmarkId, tagId: intoId })))
      .onConflictDoNothing()
  }

  await db.delete(bookmarkTags).where(eq(bookmarkTags.tagId, fromId))
  await db.delete(tags).where(eq(tags.id, fromId))
  await reindexBookmarks(rows.map((row) => row.bookmarkId))
  return { moved: rows.length }
}
