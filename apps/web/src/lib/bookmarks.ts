import { createServerFn } from '@tanstack/react-start'
import {
  bulkUpdateRecords,
  createBookmarkRecord,
  deleteBookmarkRecord,
  findDuplicateGroups,
  getBookmarkById,
  queryBookmarks,
  refetchBookmarkMetadata,
  reorderBookmarksRecord,
  setBookmarkStatus,
  updateBookmarkRecord,
} from '~/lib/bookmarks.server'
import { isBookmarkSort } from '~/lib/bookmarks.types'
import type { BookmarkFilters, BulkUpdateInput } from '~/lib/bookmarks.types'
import {
  asRecord,
  optionalString,
  optionalStringArray,
  requireString,
  requireStringArray,
} from '~/lib/validate'
import { requireSession } from '~/lib/require-session'

export const listBookmarks = createServerFn({ method: 'GET' })
  .middleware([requireSession])
  .validator((input: unknown): BookmarkFilters => {
    const record = asRecord(input)
    const status = record.status
    if (status !== 'active' && status !== 'archived' && status !== 'trashed') {
      throw new Error('Expected status to be "active", "archived", or "trashed"')
    }
    return {
      status,
      q: typeof record.q === 'string' && record.q.trim() ? record.q.trim() : undefined,
      tag:
        typeof record.tag === 'string' && record.tag.trim()
          ? record.tag.trim()
          : undefined,
      collection:
        typeof record.collection === 'string' && record.collection.trim()
          ? record.collection.trim()
          : undefined,
      sort: isBookmarkSort(record.sort) ? record.sort : undefined,
    }
  })
  .handler(async ({ data }) => queryBookmarks(data))

export const getBookmark = createServerFn({ method: 'GET' })
  .middleware([requireSession])
  .validator((input: unknown) => ({ id: requireString(input, 'id') }))
  .handler(async ({ data }) => getBookmarkById(data.id))

export const createBookmark = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => {
    const collectionId = asRecord(input).collectionId
    if (
      collectionId !== undefined &&
      collectionId !== null &&
      typeof collectionId !== 'string'
    ) {
      throw new Error('Expected "collectionId" to be a string or null')
    }
    return {
      url: requireString(input, 'url'),
      tags: optionalStringArray(input, 'tags'),
      notes: optionalString(input, 'notes'),
      collectionId: collectionId as string | null | undefined,
    }
  })
  .handler(async ({ data }) => createBookmarkRecord(data))

export const updateBookmark = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => {
    const collectionId = asRecord(input).collectionId
    if (
      collectionId !== undefined &&
      collectionId !== null &&
      typeof collectionId !== 'string'
    ) {
      throw new Error('Expected "collectionId" to be a string or null')
    }
    return {
      id: requireString(input, 'id'),
      title: optionalString(input, 'title'),
      description: optionalString(input, 'description'),
      notes: optionalString(input, 'notes'),
      tags: optionalStringArray(input, 'tags'),
      collectionId: collectionId as string | null | undefined,
    }
  })
  .handler(async ({ data }) => updateBookmarkRecord(data))

export const reorderBookmarks = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => ({ ids: requireStringArray(input, 'ids') }))
  .handler(async ({ data }) => reorderBookmarksRecord(data.ids))

export const trashBookmark = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => ({ id: requireString(input, 'id') }))
  .handler(async ({ data }) => setBookmarkStatus(data.id, 'trashed'))

export const restoreBookmark = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => ({ id: requireString(input, 'id') }))
  .handler(async ({ data }) => setBookmarkStatus(data.id, 'active'))

export const archiveBookmark = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => ({ id: requireString(input, 'id') }))
  .handler(async ({ data }) => setBookmarkStatus(data.id, 'archived'))

export const findDuplicates = createServerFn({ method: 'GET' })
  .middleware([requireSession])
  .handler(async () => findDuplicateGroups())

export const deleteBookmark = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => ({ id: requireString(input, 'id') }))
  .handler(async ({ data }) => {
    await deleteBookmarkRecord(data.id)
    return { id: data.id }
  })

export const refetchMetadata = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => ({ id: requireString(input, 'id') }))
  .handler(async ({ data }) => refetchBookmarkMetadata(data.id))

export const bulkUpdate = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown): BulkUpdateInput => {
    const record = asRecord(input)
    const collectionId = record.collectionId
    if (
      collectionId !== undefined &&
      collectionId !== null &&
      typeof collectionId !== 'string'
    ) {
      throw new Error('Expected "collectionId" to be a string or null')
    }
    const status = record.status
    if (
      status !== undefined &&
      status !== 'active' &&
      status !== 'archived' &&
      status !== 'trashed'
    ) {
      throw new Error('Expected "status" to be "active", "archived", or "trashed"')
    }
    return {
      ids: requireStringArray(input, 'ids'),
      addTags: optionalStringArray(input, 'addTags') ?? [],
      removeTags: optionalStringArray(input, 'removeTags') ?? [],
      collectionId: collectionId as string | null | undefined,
      status: status as 'active' | 'trashed' | undefined,
    }
  })
  .handler(async ({ data }) => bulkUpdateRecords(data))
