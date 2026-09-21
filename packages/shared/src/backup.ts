import { cleanText, parseDateValue } from './import'
import type { ImportedBookmark } from './import'

export type PinshelfBackup = {
  version: number
  exportedAt?: string
  collections?: unknown
  bookmarks?: unknown
}

export function looksLikePinshelfJson(text: string): boolean {
  const trimmed = text.trimStart()
  if (!trimmed.startsWith('{')) return false
  return trimmed.includes('"bookmarks"') && trimmed.includes('"version"')
}

/**
 * Parses a pinshelf JSON backup (the format `exportBookmarksJson` writes).
 * Unknown fields are ignored, trashed bookmarks keep their status so a restore
 * does not resurrect something that was deliberately binned.
 */
export function parsePinshelfJson(text: string): ImportedBookmark[] {
  let parsed: PinshelfBackup
  try {
    parsed = JSON.parse(text) as PinshelfBackup
  } catch {
    throw new Error('Backup file is not valid JSON')
  }

  if (!Array.isArray(parsed.bookmarks)) {
    throw new Error('Backup file has no bookmarks array')
  }

  const bookmarks: ImportedBookmark[] = []
  for (const entry of parsed.bookmarks) {
    if (typeof entry !== 'object' || entry === null) continue
    const row = entry as Record<string, unknown>
    if (typeof row.url !== 'string') continue

    let url: URL
    try {
      url = new URL(row.url)
    } catch {
      continue
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue

    const tags = Array.isArray(row.tags)
      ? row.tags.filter((tag): tag is string => typeof tag === 'string')
      : []

    bookmarks.push({
      url: url.toString(),
      title: cleanText(typeof row.title === 'string' ? row.title : null),
      description: cleanText(
        typeof row.description === 'string' ? row.description : null,
      ),
      notes: cleanText(typeof row.notes === 'string' ? row.notes : null),
      tags,
      collection: cleanText(typeof row.collection === 'string' ? row.collection : null),
      createdAt: parseDateValue(typeof row.createdAt === 'string' ? row.createdAt : null),
      status: row.status === 'trashed' ? 'trashed' : 'active',
    })
  }

  return bookmarks
}
