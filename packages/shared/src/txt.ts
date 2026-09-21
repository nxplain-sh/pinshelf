import { cleanText } from './import'
import type { ImportedBookmark } from './import'

const URL_PATTERN = /^https?:\/\/\S+$/i

/**
 * Parses a plain text list, one bookmark per line. A bare URL becomes a
 * bookmark; "url title words" keeps the remainder as the title.
 */
export function parseTxtBookmarks(text: string): ImportedBookmark[] {
  const bookmarks: ImportedBookmark[] = []

  for (const rawLine of text.replace(/^\uFEFF/, '').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const candidates = URL_PATTERN.test(line)
      ? [{ rawUrl: line, rest: '' }]
      : line.split(/\s+/).map((token, index, tokens) => ({
          rawUrl: token,
          rest: tokens.slice(index + 1).join(' '),
        }))

    const candidate = candidates.find((entry) => URL_PATTERN.test(entry.rawUrl))
    if (!candidate) continue

    let url: URL
    try {
      url = new URL(candidate.rawUrl)
    } catch {
      continue
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue

    bookmarks.push({
      url: url.toString(),
      title: cleanText(candidate.rest),
      description: null,
      notes: null,
      tags: [],
      collection: null,
      createdAt: null,
    })
  }

  return bookmarks
}
