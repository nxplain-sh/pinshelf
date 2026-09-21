import { parseNetscapeBookmarks } from '@pinshelf/shared'
import { env } from 'cloudflare:workers'
import { afterEach, describe, expect, it } from 'vitest'
import {
  bulkUpdateRecords,
  createBookmarkRecord,
  reorderBookmarksRecord,
  deleteBookmarkRecord,
  getBookmarkById,
  queryBookmarks,
  setBookmarkStatus,
  updateBookmarkRecord,
} from '../src/lib/bookmarks.server'
import {
  exportBookmarksJson,
  exportBookmarksNetscape,
  importBookmarks,
} from '../src/lib/import-export.server'

const IMPORT_HTML = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><A HREF="https://example.com/imported-root">Root &amp; One</A>
    <DT><A HREF="https://example.com/imported-root?utm_source=x">Duplicate of Root</A>
    <DT><H3>Reading</H3>
    <DL><p>
        <DT><A HREF="https://example.com/imported-reading" TAGS="longform, rust">Reading One</A>
    </DL><p>
    <DT><A HREF="javascript:alert(1)">Bookmarklet</A>
</DL><p>
`

const RAINDROP_CSV = `id,title,note,excerpt,url,folder,tags,created,cover,highlights,favorite
123,Paul Graham books,read this again,List of 89 book recommendations,https://csv.example.com/paul-graham,"Reading/Books","books,fun",1596669210,,,false
124,TypeScript docs,,"TS handbook",https://csv.example.com/ts-docs,"Dev/TypeScript",types,1596669300,,,true
`

const ENEX = `<?xml version="1.0" encoding="UTF-8"?>
<en-export export-date="20200101T120000Z" application="Evernote" version="10">
  <note>
    <title>Paul Graham books</title>
    <content><![CDATA[<en-note><div>89 books &amp; quotes worth reading.</div></en-note>]]></content>
    <created>20200102T030405Z</created>
    <note-attributes>
      <source-url>https://enex.example.com/paul-graham</source-url>
    </note-attributes>
    <tag>books</tag>
  </note>
  <note>
    <title>TypeScript handbook</title>
    <content><![CDATA[<en-note><div>Link: <a href="https://enex.example.com/handbook">handbook</a></div></en-note>]]></content>
    <created>20200103T000000Z</created>
    <tag>types</tag>
  </note>
</en-export>
`

const TXT_LIST = `# exported links
https://txt.example.com/from-txt
https://txt.example.com/from-txt-titled A title from the line
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
            <DT><A HREF="https://example.com/ts-docs" ADD_DATE="1596669300" TAGS="types">TS docs</A>
        </DL><p>
    </DL><p>
</DL><p>
`

async function create(url: string, extra: { tags?: string[]; notes?: string } = {}) {
  const result = await createBookmarkRecord({ url, ...extra })
  if (!result.bookmark) throw new Error(result.error ?? 'create failed')
  return { bookmark: result.bookmark, duplicate: result.duplicate }
}

// Each test starts from an empty library. `reset()` from cloudflare:test is
// not used here because it drops the schema along with the rows.
afterEach(async () => {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM bookmark_tags'),
    env.DB.prepare('DELETE FROM bookmarks'),
    env.DB.prepare('DELETE FROM tags'),
    env.DB.prepare('DELETE FROM collections'),
    env.DB.prepare('DELETE FROM bookmarks_fts'),
  ])
})

describe('createBookmarkRecord', () => {
  it('deduplicates equivalent urls and reports the duplicate', async () => {
    const first = await create('https://example.com/dedupe?utm_medium=email')
    const second = await create('https://example.com/dedupe')
    expect(second.duplicate).toBe(true)
    expect(second.bookmark.id).toBe(first.bookmark.id)
  })

  it('restores a trashed bookmark when it is saved again', async () => {
    const first = await create('https://example.com/restore-me')
    await setBookmarkStatus(first.bookmark.id, 'trashed')

    const again = await create('https://example.com/restore-me')
    expect(again.duplicate).toBe(true)
    expect(again.bookmark.status).toBe('active')
  })

  it('rejects non-http urls with an error instead of throwing', async () => {
    const result = await createBookmarkRecord({ url: 'ftp://example.com/x' })
    expect(result.bookmark).toBeNull()
    expect(result.error).toContain('http(s)')
  })
})

describe('tags', () => {
  it('replaces tags on update and prunes orphans', async () => {
    const { bookmark } = await create('https://example.com/tag-lifecycle', {
      tags: ['alpha', 'beta'],
    })

    await updateBookmarkRecord({ id: bookmark.id, tags: ['beta', 'gamma'] })
    const after = await getBookmarkById(bookmark.id)
    expect(after?.tags).toEqual(['beta', 'gamma'])

    await updateBookmarkRecord({ id: bookmark.id, tags: [] })
    const empty = await getBookmarkById(bookmark.id)
    expect(empty?.tags).toEqual([])
  })

  it('adds and removes tags in bulk', async () => {
    const a = await create('https://example.com/bulk-a')
    const b = await create('https://example.com/bulk-b')

    await bulkUpdateRecords({ ids: [a.bookmark.id, b.bookmark.id], addTags: ['shared'] })
    expect((await getBookmarkById(a.bookmark.id))?.tags).toEqual(['shared'])
    expect((await getBookmarkById(b.bookmark.id))?.tags).toEqual(['shared'])

    await bulkUpdateRecords({ ids: [a.bookmark.id], removeTags: ['shared'] })
    expect((await getBookmarkById(a.bookmark.id))?.tags).toEqual([])
    expect((await getBookmarkById(b.bookmark.id))?.tags).toEqual(['shared'])

    await bulkUpdateRecords({ ids: [b.bookmark.id], removeTags: ['shared'] })
    const orphanSearch = await queryBookmarks({ status: 'active', q: 'shared' })
    expect(orphanSearch).toHaveLength(0)
  })
})

describe('search', () => {
  it('matches notes, url, and tag text', async () => {
    await create('https://example.com/searchable', {
      tags: ['searchtag'],
      notes: 'a distinctive note about ferrets',
    })

    expect(await queryBookmarks({ status: 'active', q: 'ferrets' })).toHaveLength(1)
    expect(await queryBookmarks({ status: 'active', q: 'searchtag' })).toHaveLength(1)
    expect(await queryBookmarks({ status: 'active', q: 'searchable' })).toHaveLength(1)
    expect(await queryBookmarks({ status: 'active', q: 'axolotl' })).toHaveLength(0)
  })

  it('drops the row from the index when a bookmark is deleted', async () => {
    const { bookmark } = await create('https://example.com/delete-me', {
      notes: 'ephemeral quokka note',
    })
    expect(await queryBookmarks({ status: 'active', q: 'quokka' })).toHaveLength(1)

    await deleteBookmarkRecord(bookmark.id)
    expect(await queryBookmarks({ status: 'active', q: 'quokka' })).toHaveLength(0)
  })
})

describe('sorting', () => {
  it('orders by newest, oldest, and title', async () => {
    const alpha = await create('https://example.com/sort-alpha')
    await updateBookmarkRecord({ id: alpha.bookmark.id, title: 'Alpha' })
    const zulu = await create('https://example.com/sort-zulu')
    await updateBookmarkRecord({ id: zulu.bookmark.id, title: 'Zulu' })

    const titles = (rows: { title: string | null }[]) => rows.map((row) => row.title)

    expect(titles(await queryBookmarks({ status: 'active', sort: 'title-asc' }))).toEqual(
      ['Alpha', 'Zulu'],
    )
    expect(
      titles(await queryBookmarks({ status: 'active', sort: 'title-desc' })),
    ).toEqual(['Zulu', 'Alpha'])
    expect(titles(await queryBookmarks({ status: 'active', sort: 'oldest' }))).toEqual([
      'Alpha',
      'Zulu',
    ])
    expect(titles(await queryBookmarks({ status: 'active', sort: 'newest' }))).toEqual([
      'Zulu',
      'Alpha',
    ])
  })
})

describe('manual ordering', () => {
  it('keeps the order written by reorder and puts new saves on top', async () => {
    const one = await create('https://example.com/manual-one')
    const two = await create('https://example.com/manual-two')
    const three = await create('https://example.com/manual-three')

    const ids = (rows: { id: string }[]) => rows.map((row) => row.id)

    // Nothing indexed yet, and createdAt has second resolution, so only the
    // set is asserted here; the fallback order is covered by the next case.
    expect(
      new Set(ids(await queryBookmarks({ status: 'active', sort: 'manual' }))),
    ).toEqual(new Set([one.bookmark.id, two.bookmark.id, three.bookmark.id]))

    const reordered = [two.bookmark.id, one.bookmark.id, three.bookmark.id]
    const result = await reorderBookmarksRecord(reordered)
    expect(result.updated).toBe(3)

    expect(ids(await queryBookmarks({ status: 'active', sort: 'manual' }))).toEqual(
      reordered,
    )

    // A bookmark saved after reordering has no index and sorts to the top.
    const four = await create('https://example.com/manual-four')
    expect(ids(await queryBookmarks({ status: 'active', sort: 'manual' }))).toEqual([
      four.bookmark.id,
      ...reordered,
    ])

    // The default sort still returns everything, unaffected by manual indexes.
    expect(ids(await queryBookmarks({ status: 'active' }))).toHaveLength(4)
  })
})

describe('import', () => {
  it('imports folders as collections, tags as tags, and skips duplicates', async () => {
    const summary = await importBookmarks(IMPORT_HTML, 'bookmarks.html')

    expect(summary.imported).toBe(2)
    expect(summary.duplicates).toBe(1)
    expect(summary.collectionsCreated).toBe(1)
    expect(summary.tagsCreated).toBe(2)

    const reading = await queryBookmarks({ status: 'active', q: 'rust' })
    expect(reading).toHaveLength(1)
    expect(reading[0].collectionName).toBe('Reading')
    expect(reading[0].tags).toEqual(['longform', 'rust'])
    expect(reading[0].metadataStatus).toBe('done')

    const second = await importBookmarks(IMPORT_HTML, 'bookmarks.html')
    expect(second.imported).toBe(0)
    expect(second.duplicates).toBe(3)
  })

  it('imports csv, enex, and txt exports', async () => {
    const csv = await importBookmarks(RAINDROP_CSV, 'raindrop.csv')
    expect(csv.imported).toBe(2)
    expect(csv.collectionsCreated).toBe(2)

    const csvRow = await queryBookmarks({ status: 'active', q: 'paul graham books' })
    expect(csvRow[0].notes).toBe('read this again')
    expect(csvRow[0].description).toBe('List of 89 book recommendations')
    expect(csvRow[0].collectionName).toBe('Reading/Books')
    expect(csvRow[0].createdAt).toEqual(new Date(1596669210 * 1000))

    const enex = await importBookmarks(ENEX, 'notes.enex')
    expect(enex.imported).toBe(2)

    const note = await queryBookmarks({ status: 'active', q: 'link handbook' })
    expect(note).toHaveLength(1)
    expect(note[0].notes).toContain('Link: handbook')
    expect(note[0].tags).toEqual(['types'])

    const txt = await importBookmarks(TXT_LIST, 'links.txt')
    expect(txt.imported).toBe(2)

    const titled = await queryBookmarks({ status: 'active', q: 'title from the line' })
    expect(titled).toHaveLength(1)
    expect(titled[0].title).toBe('A title from the line')
  })

  it('imports a raindrop export with descriptions, dates, and nested folders', async () => {
    const summary = await importBookmarks(RAINDROP_EXPORT, 'raindrop.html')
    expect(summary.imported).toBe(2)
    expect(summary.collectionsCreated).toBe(1)

    const saved = await queryBookmarks({ status: 'active', q: 'paul graham' })
    expect(saved).toHaveLength(1)
    expect(saved[0].description).toContain('89 verified book recommendations')
    expect(saved[0].collectionName).toBeNull()
    expect(saved[0].tags.slice().sort()).toEqual(
      ['Read Later', 'books', 'fun', 'interesting'].sort(),
    )
    expect(saved[0].createdAt).toEqual(new Date(1596669210 * 1000))

    const nested = await queryBookmarks({ status: 'active', q: 'ts docs' })
    expect(nested[0].collectionName).toBe('Dev/TypeScript')
  })
})

describe('export', () => {
  it('round-trips through json and netscape html', async () => {
    const { bookmark } = await create('https://example.com/export-me', {
      tags: ['longform', 'rust'],
      notes: 'kept in json only',
    })

    const { db } = await import('../src/db/index.server')
    const { collections, bookmarks } = await import('../src/db/schema')
    const { eq } = await import('drizzle-orm')

    const now = new Date()
    const [collection] = await db
      .insert(collections)
      .values({
        id: crypto.randomUUID(),
        name: 'Reading',
        nameKey: 'reading',
        createdAt: now,
        updatedAt: now,
      })
      .returning()
    await db
      .update(bookmarks)
      .set({ collectionId: collection.id })
      .where(eq(bookmarks.id, bookmark.id))

    const json = JSON.parse(await exportBookmarksJson()) as {
      version: number
      bookmarks: {
        url: string
        tags: string[]
        notes: string | null
        collection: string | null
      }[]
    }
    expect(json.version).toBe(1)
    expect(json.bookmarks).toHaveLength(1)
    expect(json.bookmarks[0].tags).toEqual(['longform', 'rust'])
    expect(json.bookmarks[0].notes).toBe('kept in json only')
    expect(json.bookmarks[0].collection).toBe('Reading')

    const html = await exportBookmarksNetscape()
    const reparsed = parseNetscapeBookmarks(html)
    expect(reparsed).toHaveLength(1)
    expect(reparsed[0].collection).toBe('Reading')
    expect(reparsed[0].tags).toEqual(['longform', 'rust'])
  })
})
