import { decodeEntities } from './netscape'
import { cleanText } from './import'
import type { ImportedBookmark } from './import'

const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/i

function unwrapCdata(value: string): string {
  const match = value.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/)
  return match ? match[1] : value
}

function stripMarkup(value: string): string {
  return decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]*>/g, ''),
  )
}

function tagValue(note: string, tag: string): string | null {
  const match = note.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  return match ? unwrapCdata(match[1]) : null
}

function tagValues(note: string, tag: string): string[] {
  const matches = note.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi'))
  return [...matches].map((match) => unwrapCdata(match[1]).trim()).filter(Boolean)
}

export function parseEnexDate(value: string | null): Date | null {
  if (!value) return null
  const match = value.trim().match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/)
  if (!match) return null
  const [, year, month, day, hour, minute, second] = match
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  )
}

export function looksLikeEnex(text: string): boolean {
  return /<en-export[\s>]/i.test(text.slice(0, 4000))
}

/**
 * Parses an Evernote `.enex` export. Each note becomes one bookmark: the URL
 * comes from `<source-url>` when present (web clipper), otherwise from the
 * first link in the note body. Notes without a link are skipped.
 */
export function parseEnexBookmarks(xml: string): ImportedBookmark[] {
  const bookmarks: ImportedBookmark[] = []
  const notes = xml.matchAll(/<note>([\s\S]*?)<\/note>/gi)

  for (const match of notes) {
    const note = match[1]
    const rawContent = tagValue(note, 'content') ?? ''

    const sourceUrl = tagValue(note, 'source-url')?.trim()
    const fromContent = rawContent.match(URL_PATTERN)?.[0]
    const rawUrl = sourceUrl || fromContent
    if (!rawUrl) continue

    let url: URL
    try {
      url = new URL(decodeEntities(rawUrl))
    } catch {
      continue
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue

    bookmarks.push({
      url: url.toString(),
      title: cleanText(tagValue(note, 'title')),
      description: null,
      notes: cleanText(stripMarkup(rawContent)),
      tags: tagValues(note, 'tag')
        .map((tag) => decodeEntities(tag).trim())
        .filter(Boolean),
      collection: cleanText(tagValue(note, 'notebook')),
      createdAt: parseEnexDate(tagValue(note, 'created')),
    })
  }

  return bookmarks
}
