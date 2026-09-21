import type { BookmarkFilters, BookmarkListItem } from '~/lib/bookmarks.types'

// Offline reading keeps the last list per filter set in localStorage. The
// service worker deliberately caches only static assets (ADR-0011), so this is
// what makes an already-open app usable on a flaky connection — with a visible
// staleness banner, never silently.
const PREFIX = 'pinshelf:list:'

export type CachedList = { items: BookmarkListItem[]; savedAt: string }

export function listCacheKey(filters: BookmarkFilters): string {
  return `${PREFIX}${JSON.stringify([
    filters.status,
    filters.q ?? '',
    filters.tag ?? '',
    filters.collection ?? '',
    filters.sort ?? '',
  ])}`
}

export function readCachedList(key: string): CachedList | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedList
    if (!Array.isArray(parsed.items) || typeof parsed.savedAt !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

export function writeCachedList(key: string, items: BookmarkListItem[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({ items, savedAt: new Date().toISOString() }),
    )
  } catch {
    // Private mode or a full quota: caching is a nicety, never a failure.
  }
}
