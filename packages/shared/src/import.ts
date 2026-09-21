import { looksLikePinshelfJson, parsePinshelfJson } from './backup'
import { looksLikeCsv, parseCsvBookmarks } from './csv'
import { looksLikeEnex, parseEnexBookmarks } from './enex'
import { parseNetscapeBookmarks } from './netscape'
import { parseTxtBookmarks } from './txt'

export type ImportedBookmark = {
  url: string
  title: string | null
  description: string | null
  notes: string | null
  tags: string[]
  collection: string | null
  createdAt: Date | null
  /** Only JSON backups carry this; every other format imports as active. */
  status?: 'active' | 'trashed'
}

/**
 * Detects the format and parses it. Content sniffing wins over the file
 * extension, so a `.txt` file containing an HTML export still imports.
 */
export function parseImportFile(contents: string, filename = ''): ImportedBookmark[] {
  const text = contents.replace(/^\uFEFF/, '')
  const name = filename.toLowerCase()

  if (looksLikePinshelfJson(text)) return parsePinshelfJson(text)
  if (name.endsWith('.enex') || looksLikeEnex(text)) return parseEnexBookmarks(text)
  if (name.endsWith('.csv') || looksLikeCsv(text)) return parseCsvBookmarks(text)
  if (name.endsWith('.html') || name.endsWith('.htm') || /^\s*</.test(text)) {
    return parseNetscapeBookmarks(text)
  }
  return parseTxtBookmarks(text)
}

export type ExportableBookmark = {
  url: string
  title: string | null
  description: string | null
  tags: string[]
  collection: string | null
  createdAt: Date | null
  notes?: string | null
  status?: 'active' | 'archived' | 'trashed'
}

const MAX_TEXT = 10_000

export function cleanText(value: string | null | undefined): string | null {
  if (!value) return null
  const collapsed = value.replace(/\s+/g, ' ').trim()
  return collapsed ? collapsed.slice(0, MAX_TEXT) : null
}

export function parseDateValue(value: string | null | undefined): Date | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  if (/^\d{10}$/.test(trimmed)) return new Date(Number(trimmed) * 1000)
  if (/^\d{13}$/.test(trimmed)) return new Date(Number(trimmed))

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
