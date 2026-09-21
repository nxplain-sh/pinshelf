import type { ExportableBookmark, ImportedBookmark } from './import'

export type { ExportableBookmark, ImportedBookmark } from './import'

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
  '#x27': "'",
  '#x2F': '/',
}

export function decodeEntities(input: string): string {
  return input.replace(/&(#?x?[0-9a-zA-Z]+);/g, (match, code: string) => {
    const known = ENTITIES[code.toLowerCase()]
    if (known !== undefined) return known
    if (code.startsWith('#x') || code.startsWith('#X')) {
      const value = Number.parseInt(code.slice(2), 16)
      return Number.isNaN(value) ? match : String.fromCodePoint(value)
    }
    if (code.startsWith('#')) {
      const value = Number.parseInt(code.slice(1), 10)
      return Number.isNaN(value) ? match : String.fromCodePoint(value)
    }
    return match
  })
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function attribute(attributes: string, name: string): string | null {
  const match = attributes.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i'))
  return match ? match[1] : null
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, '')).trim()
}

function parseDate(attributes: string): Date | null {
  const raw = attribute(attributes, 'ADD_DATE')
  if (!raw) return null
  const seconds = Number.parseInt(raw, 10)
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  return new Date(seconds * 1000)
}

/**
 * Parses the Netscape bookmark format exported by Chrome, Firefox, Safari, and
 * Raindrop. Folders become collections, joined with "/" when nested so the
 * hierarchy survives in a flat model. `TAGS` attributes become tags, `<DD>`
 * lines become descriptions, and `ADD_DATE` becomes the creation time.
 *
 * Raindrop exports an "Unsorted" folder for bookmarks without a collection;
 * that name maps to no collection rather than to a collection called Unsorted.
 * Non-http(s) entries are skipped.
 */
export function parseNetscapeBookmarks(html: string): ImportedBookmark[] {
  const results: ImportedBookmark[] = []
  const folderStack: string[] = []
  const tokenPattern =
    /<h3[^>]*>([\s\S]*?)<\/h3>|<a\s+([^>]*)>([\s\S]*?)<\/a>|<dd[^>]*>([\s\S]*?)(?=<dt|<dl|<\/dl|<\/h1|<\/body|$)|<\/dl>/gi

  for (const match of html.matchAll(tokenPattern)) {
    const [token, heading, attributes, label, description] = match

    if (heading !== undefined) {
      const name = stripTags(heading)
      folderStack.push(name || 'Imported')
      continue
    }

    if (attributes !== undefined) {
      const href = attribute(attributes, 'HREF')
      if (!href) continue
      let url: URL
      try {
        url = new URL(decodeEntities(href).trim())
      } catch {
        continue
      }
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue

      const rawTags = attribute(attributes, 'TAGS') ?? ''
      results.push({
        url: url.toString(),
        title: stripTags(label ?? '') || null,
        description: null,
        notes: null,
        tags: rawTags
          .split(',')
          .map((tag) => decodeEntities(tag).trim())
          .filter(Boolean),
        collection: collectionFromStack(folderStack),
        createdAt: parseDate(attributes),
      })
      continue
    }

    if (description !== undefined) {
      const text = stripTags(description)
      const last = results.at(-1)
      if (text && last && last.description === null) {
        last.description = text
      }
      continue
    }

    if (token.toLowerCase() === '</dl>') {
      folderStack.pop()
    }
  }

  return results
}

function collectionFromStack(stack: string[]): string | null {
  if (stack.length === 0) return null
  if (stack.length === 1 && stack[0].toLowerCase() === 'unsorted') return null
  return stack.join('/')
}

export function toNetscapeHtml(bookmarks: ExportableBookmark[]): string {
  const byCollection = new Map<string, ExportableBookmark[]>()
  for (const bookmark of bookmarks) {
    const key = bookmark.collection ?? ''
    const list = byCollection.get(key) ?? []
    list.push(bookmark)
    byCollection.set(key, list)
  }

  const lines: string[] = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ]

  for (const [collection, entries] of byCollection) {
    const indent = collection ? '    ' : '  '
    if (collection) {
      lines.push(`    <DT><H3>${escapeText(collection)}</H3>`)
      lines.push('    <DL><p>')
    }
    for (const bookmark of entries) {
      const attributes = [
        `HREF="${escapeAttribute(bookmark.url)}"`,
        bookmark.createdAt
          ? `ADD_DATE="${Math.floor(bookmark.createdAt.getTime() / 1000)}"`
          : null,
        bookmark.tags.length > 0
          ? `TAGS="${escapeAttribute(bookmark.tags.join(','))}"`
          : null,
      ]
        .filter(Boolean)
        .join(' ')
      lines.push(
        `${indent}<DT><A ${attributes}>${escapeText(bookmark.title ?? bookmark.url)}</A>`,
      )
      if (bookmark.description) {
        lines.push(`${indent}<DD>${escapeText(bookmark.description)}`)
      }
    }
    if (collection) {
      lines.push('    </DL><p>')
    }
  }

  lines.push('</DL><p>')
  return `${lines.join('\n')}\n`
}
