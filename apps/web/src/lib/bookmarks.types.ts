import type { Bookmark } from '~/db/schema'

export type BookmarkListItem = Bookmark & {
  tags: string[]
  collectionName: string | null
}

export type BookmarkSort = 'newest' | 'oldest' | 'title-asc' | 'title-desc' | 'manual'

export function isBookmarkSort(value: unknown): value is BookmarkSort {
  return (
    value === 'newest' ||
    value === 'oldest' ||
    value === 'title-asc' ||
    value === 'title-desc' ||
    value === 'manual'
  )
}

export type BookmarkStatus = 'active' | 'archived' | 'trashed'

export type BookmarkFilters = {
  status: BookmarkStatus
  q?: string
  tag?: string
  collection?: string
  sort?: BookmarkSort
  /** Exact url match, used by the extension's saved-page indicator. */
  url?: string
  /** Exact host match, without `www.`. */
  host?: string
}

export type CreateBookmarkInput = {
  url: string
  tags?: string[]
  collectionId?: string | null
  notes?: string
}

export type CreateBookmarkResult = {
  bookmark: Bookmark | null
  duplicate: boolean
  error: string | null
}

export type UpdateBookmarkInput = {
  id: string
  title?: string
  description?: string
  notes?: string
  tags?: string[]
  collectionId?: string | null
}

export type BulkUpdateInput = {
  ids: string[]
  addTags?: string[]
  removeTags?: string[]
  collectionId?: string | null
  status?: BookmarkStatus
}
