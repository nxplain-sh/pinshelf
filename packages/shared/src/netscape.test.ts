import { describe, expect, it } from 'vitest'
import type { ImportedBookmark } from './import'
import { decodeEntities, parseNetscapeBookmarks, toNetscapeHtml } from './netscape'

function bookmark(
  overrides: Partial<ImportedBookmark> & { url: string },
): ImportedBookmark {
  return {
    title: null,
    description: null,
    notes: null,
    tags: [],
    collection: null,
    createdAt: null,
    ...overrides,
  }
}

const CHROME_EXPORT = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><A HREF="https://example.com/one" ADD_DATE="1700000000">Example &amp; One</A>
    <DT><H3 ADD_DATE="1700000000">Dev</H3>
    <DL><p>
        <DT><A HREF="https://example.com/two" ADD_DATE="1700000001" TAGS="react, frontend">Two &lt;b&gt;</A>
        <DT><H3>Nested</H3>
        <DL><p>
            <DT><A HREF="https://example.com/three">Three</A>
        </DL><p>
    </DL><p>
    <DT><A HREF="javascript:alert(1)">Bookmarklet</A>
    <DT><A HREF="place:sort=8">Firefox place</A>
</DL><p>
`

const RAINDROP_EXPORT = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="0" LAST_MODIFIED="0">Unsorted</H3>
    <DL><p>
    <DT><A HREF="https://www.readthistwice.com/person/paul-graham" ADD_DATE="1596669210" LAST_MODIFIED="1596669220" TAGS="Read Later,books,fun,interesting">89 books Paul Graham recommended</A>
    <DD>(Updated 2020) The most up to date and comprehensive list of 89 verified book recommendations from Paul Graham. Includes quotes and sources.
    </DL><p>
    <DT><H3 ADD_DATE="0" LAST_MODIFIED="0">Dev</H3>
    <DL><p>
        <DT><H3 ADD_DATE="0" LAST_MODIFIED="0">TypeScript</H3>
        <DL><p>
            <DT><A HREF="https://example.com/ts" ADD_DATE="1596669300" TAGS="types">TS docs</A>
        </DL><p>
    </DL><p>
</DL><p>
`

describe('parseNetscapeBookmarks', () => {
  it('extracts bookmarks with titles, folders, tags, dates, and descriptions', () => {
    const parsed = parseNetscapeBookmarks(CHROME_EXPORT)

    expect(parsed).toHaveLength(3)
    expect(parsed[0]).toEqual(
      bookmark({
        url: 'https://example.com/one',
        title: 'Example & One',
        createdAt: new Date(1700000000 * 1000),
      }),
    )
    expect(parsed[1]).toEqual(
      bookmark({
        url: 'https://example.com/two',
        title: 'Two <b>',
        tags: ['react', 'frontend'],
        collection: 'Dev',
        createdAt: new Date(1700000001 * 1000),
      }),
    )
    expect(parsed[2]).toEqual(
      bookmark({
        url: 'https://example.com/three',
        title: 'Three',
        collection: 'Dev/Nested',
      }),
    )
  })

  it('parses a raindrop export: DD descriptions, ADD_DATE, Unsorted, spaced tags', () => {
    const parsed = parseNetscapeBookmarks(RAINDROP_EXPORT)

    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toEqual(
      bookmark({
        url: 'https://www.readthistwice.com/person/paul-graham',
        title: '89 books Paul Graham recommended',
        description:
          '(Updated 2020) The most up to date and comprehensive list of 89 verified book recommendations from Paul Graham. Includes quotes and sources.',
        tags: ['Read Later', 'books', 'fun', 'interesting'],
        createdAt: new Date(1596669210 * 1000),
      }),
    )
    expect(parsed[1]).toEqual(
      bookmark({
        url: 'https://example.com/ts',
        title: 'TS docs',
        tags: ['types'],
        collection: 'Dev/TypeScript',
        createdAt: new Date(1596669300 * 1000),
      }),
    )
  })

  it('skips non-http entries and malformed hrefs', () => {
    const parsed = parseNetscapeBookmarks(CHROME_EXPORT)
    expect(parsed.some((entry) => entry.url.startsWith('javascript:'))).toBe(false)
    expect(parsed.some((entry) => entry.url.startsWith('place:'))).toBe(false)
  })

  it('returns an empty list for empty or unrelated input', () => {
    expect(parseNetscapeBookmarks('')).toEqual([])
    expect(parseNetscapeBookmarks('<html><body>hi</body></html>')).toEqual([])
  })
})

describe('decodeEntities', () => {
  it('decodes named, decimal, and hex entities', () => {
    expect(decodeEntities('a &amp; b &lt;c&gt; &#39;d&#x27;')).toBe("a & b <c> 'd'")
    expect(decodeEntities('&unknown;')).toBe('&unknown;')
  })
})

describe('toNetscapeHtml', () => {
  it('round-trips through the parser, including descriptions and dates', () => {
    const html = toNetscapeHtml([
      {
        url: 'https://example.com/one',
        title: 'Example & One',
        description: 'A description with & and <tags>',
        tags: ['a', 'b'],
        collection: null,
        createdAt: new Date('2026-01-02T03:04:05Z'),
      },
      {
        url: 'https://example.com/two',
        title: 'Two "quoted"',
        description: null,
        tags: [],
        collection: 'Dev',
        createdAt: null,
      },
    ])

    const parsed = parseNetscapeBookmarks(html)
    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toEqual(
      bookmark({
        url: 'https://example.com/one',
        title: 'Example & One',
        description: 'A description with & and <tags>',
        tags: ['a', 'b'],
        createdAt: new Date('2026-01-02T03:04:05Z'),
      }),
    )
    expect(parsed[1]).toEqual(
      bookmark({
        url: 'https://example.com/two',
        title: 'Two "quoted"',
        collection: 'Dev',
      }),
    )
  })

  it('falls back to the url when a bookmark has no title', () => {
    const html = toNetscapeHtml([
      {
        url: 'https://example.com/x',
        title: null,
        description: null,
        tags: [],
        collection: null,
        createdAt: null,
      },
    ])
    expect(html).toContain('>https://example.com/x</A>')
  })
})
