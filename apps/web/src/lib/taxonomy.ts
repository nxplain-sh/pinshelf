import { normalizeTagName, tagNameKey } from '@pinshelf/shared'
import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { db } from '~/db/index.server'
import { bookmarks, collections } from '~/db/schema'
import {
  mergeTagsRecord,
  queryCollections,
  queryTags,
  renameTagRecord,
} from '~/lib/taxonomy.server'
import { requireString } from '~/lib/validate'
import { requireSession } from '~/lib/require-session'

export const listTags = createServerFn({ method: 'GET' })
  .middleware([requireSession])
  .handler(async () => {
    return queryTags()
  })

export const listCollections = createServerFn({ method: 'GET' })
  .middleware([requireSession])
  .handler(async () => {
    return queryCollections()
  })

export const createCollection = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => ({ name: requireString(input, 'name') }))
  .handler(async ({ data }) => {
    const name = normalizeTagName(data.name)
    if (!name) {
      return { collection: null, error: 'Collection name is required' }
    }
    const nameKey = tagNameKey(name)

    const [existing] = await db
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.nameKey, nameKey))
      .limit(1)
    if (existing) {
      return { collection: null, error: 'A collection with that name already exists' }
    }

    const now = new Date()
    const [collection] = await db
      .insert(collections)
      .values({ id: crypto.randomUUID(), name, nameKey, createdAt: now, updatedAt: now })
      .returning()
    return { collection, error: null }
  })

export const renameCollection = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => ({
    id: requireString(input, 'id'),
    name: requireString(input, 'name'),
  }))
  .handler(async ({ data }) => {
    const name = normalizeTagName(data.name)
    if (!name) {
      return { collection: null, error: 'Collection name is required' }
    }
    const nameKey = tagNameKey(name)

    const [conflict] = await db
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.nameKey, nameKey))
      .limit(1)
    if (conflict && conflict.id !== data.id) {
      return { collection: null, error: 'A collection with that name already exists' }
    }

    const [collection] = await db
      .update(collections)
      .set({ name, nameKey, updatedAt: new Date() })
      .where(eq(collections.id, data.id))
      .returning()
    return { collection: collection ?? null, error: null }
  })

export const renameTag = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => ({
    id: requireString(input, 'id'),
    name: requireString(input, 'name'),
  }))
  .handler(async ({ data }) => {
    try {
      return { tag: await renameTagRecord(data.id, data.name), error: null }
    } catch (cause) {
      return {
        tag: null,
        error: cause instanceof Error ? cause.message : 'Could not rename the tag',
      }
    }
  })

export const mergeTag = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => ({
    fromId: requireString(input, 'fromId'),
    intoId: requireString(input, 'intoId'),
  }))
  .handler(async ({ data }) => {
    try {
      return {
        moved: (await mergeTagsRecord(data.fromId, data.intoId)).moved,
        error: null,
      }
    } catch (cause) {
      return {
        moved: 0,
        error: cause instanceof Error ? cause.message : 'Could not merge the tags',
      }
    }
  })

export const deleteCollection = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => ({ id: requireString(input, 'id') }))
  .handler(async ({ data }) => {
    const [collection] = await db
      .select({ id: collections.id, name: collections.name })
      .from(collections)
      .where(eq(collections.id, data.id))
      .limit(1)
    if (!collection) return { id: data.id, name: null }

    await db
      .update(bookmarks)
      .set({ collectionId: null, updatedAt: new Date() })
      .where(eq(bookmarks.collectionId, data.id))
    await db.delete(collections).where(eq(collections.id, data.id))

    return { id: data.id, name: collection.name }
  })
