import type { ExportableBookmark } from './import'

function escapeText(value: string): string {
  return value.replace(/([\\`*_[\]()])/g, '\\$1')
}

function day(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : 'unknown'
}

/**
 * A Markdown reading list: one bullet per bookmark, with tags, collection, and
 * save date on an indented line. Trashed rows are kept and marked, so the file
 * is a faithful copy of the library rather than a filtered view.
 */
export function toMarkdown(bookmarks: ExportableBookmark[]): string {
  const lines = ['# pinshelf', '', `${bookmarks.length} bookmarks`, '']

  for (const row of bookmarks) {
    lines.push(`- [${escapeText(row.title ?? row.url)}](${row.url})`)

    const meta = [`saved: ${day(row.createdAt)}`]
    if (row.tags.length > 0) meta.push(`tags: ${row.tags.join(', ')}`)
    if (row.collection) meta.push(`collection: ${row.collection}`)
    if (row.status === 'trashed') meta.push('trashed')
    if (row.status === 'archived') meta.push('archived')
    lines.push(`  ${meta.join(' · ')}`)

    if (row.description) lines.push(`  ${escapeText(row.description)}`)
    if (row.notes) lines.push(`  notes: ${escapeText(row.notes)}`)
  }

  return `${lines.join('\n')}\n`
}
