import { cleanText, parseDateValue } from './import'
import type { ImportedBookmark } from './import'

const COLUMN_ALIASES = {
  url: ['url', 'link', 'href'],
  title: ['title', 'name'],
  description: ['excerpt', 'description', 'summary'],
  notes: ['note', 'notes'],
  tags: ['tags', 'tag'],
  collection: ['folder', 'collection', 'collections', 'list', 'notebook'],
  createdAt: ['created', 'created_at', 'createdat', 'date', 'add_date', 'added'],
} satisfies Record<string, string[]>

type ColumnKey = keyof typeof COLUMN_ALIASES

export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index++) {
    const char = text[index]

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index++
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') {
      field += char
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

export function looksLikeCsv(text: string): boolean {
  const firstLine = text.slice(
    0,
    text.indexOf('\n') === -1 ? text.length : text.indexOf('\n'),
  )
  if (!firstLine.includes(',')) return false
  return /(^|,)\s*"?url"?\s*(,|$)/i.test(firstLine)
}

export function parseCsvBookmarks(text: string): ImportedBookmark[] {
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ''))
  const [header, ...body] = rows
  if (!header) return []

  const columns = new Map<string, number>()
  header.forEach((name, index) => {
    columns.set(name.trim().toLowerCase(), index)
  })

  const findColumn = (key: ColumnKey): number | undefined => {
    for (const alias of COLUMN_ALIASES[key]) {
      const index = columns.get(alias)
      if (index !== undefined) return index
    }
    return undefined
  }

  const urlIndex = findColumn('url')
  if (urlIndex === undefined) return []

  const indexes = {
    title: findColumn('title'),
    description: findColumn('description'),
    notes: findColumn('notes'),
    tags: findColumn('tags'),
    collection: findColumn('collection'),
    createdAt: findColumn('createdAt'),
  }

  const value = (row: string[], index: number | undefined): string | undefined =>
    index === undefined ? undefined : row[index]

  const bookmarks: ImportedBookmark[] = []
  for (const row of body) {
    const rawUrl = value(row, urlIndex)?.trim()
    if (!rawUrl) continue

    let url: URL
    try {
      url = new URL(rawUrl)
    } catch {
      continue
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue

    const rawTags = value(row, indexes.tags) ?? ''
    bookmarks.push({
      url: url.toString(),
      title: cleanText(value(row, indexes.title)),
      description: cleanText(value(row, indexes.description)),
      notes: cleanText(value(row, indexes.notes)),
      tags: rawTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      collection: cleanText(value(row, indexes.collection)),
      createdAt: parseDateValue(value(row, indexes.createdAt)),
    })
  }

  return bookmarks
}
