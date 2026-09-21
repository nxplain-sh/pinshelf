import { describe, expect, it } from 'vitest'
import { parseCsvBookmarks, parseCsvRows } from './csv'
import { parseEnexBookmarks } from './enex'
import type { ImportedBookmark } from './import'
import { parseImportFile } from './import'
import { parseTxtBookmarks } from './txt'

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

const RAINDROP_CSV = `id,title,note,excerpt,url,folder,tags,created,cover,highlights,favorite
123,Paul Graham books,read this again,List of 89 book recommendations,https://www.readthistwice.com/person/paul-graham,"Reading/Books","books,fun",1596669210,,,false
124,TypeScript docs,,"TS handbook",https://www.typescriptlang.org/docs/,"Dev/TypeScript",types,1596669300,,,true
`

const ENEX = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-export SYSTEM "http://xml.evernote.com/pub/evernote-export4.dtd">
<en-export export-date="20200101T120000Z" application="Evernote" version="10">
  <note>
    <title>Paul Graham books</title>
    <content><![CDATA[<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd">
<en-note><div>89 books &amp; quotes worth reading.</div></en-note>]]></content>
    <created>20200102T030405Z</created>
    <note-attributes>
      <source-url>https://www.readthistwice.com/person/paul-graham</source-url>
    </note-attributes>
    <tag>books</tag>
    <tag>Read Later</tag>
  </note>
  <note>
    <title>TypeScript handbook</title>
    <content><![CDATA[<en-note><div>Link: <a href="https://www.typescriptlang.org/docs/">handbook</a></div></en-note>]]></content>
    <created>20200103T000000Z</created>
    <tag>types</tag>
  </note>
  <note>
    <title>No link here</title>
    <content><![CDATA[<en-note><div>just a thought</div></en-note>]]></content>
  </note>
</en-export>
`

describe('parseCsvRows', () => {
  it('handles quotes, embedded commas, escaped quotes, and CRLF', () => {
    const rows = parseCsvRows('a,b\r\n"x, y","say ""hi"""\r\n')
    expect(rows).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
    ])
  })
})

describe('parseCsvBookmarks', () => {
  it('maps raindrop columns including note, excerpt, folder, tags, and created', () => {
    const parsed = parseCsvBookmarks(RAINDROP_CSV)

    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toEqual(
      bookmark({
        url: 'https://www.readthistwice.com/person/paul-graham',
        title: 'Paul Graham books',
        notes: 'read this again',
        description: 'List of 89 book recommendations',
        tags: ['books', 'fun'],
        collection: 'Reading/Books',
        createdAt: new Date(1596669210 * 1000),
      }),
    )
    expect(parsed[1]).toEqual(
      bookmark({
        url: 'https://www.typescriptlang.org/docs/',
        title: 'TypeScript docs',
        description: 'TS handbook',
        tags: ['types'],
        collection: 'Dev/TypeScript',
        createdAt: new Date(1596669300 * 1000),
      }),
    )
  })

  it('works with a minimal url,title header', () => {
    const parsed = parseCsvBookmarks('url,title\nhttps://example.com/x,Example\n')
    expect(parsed).toEqual([bookmark({ url: 'https://example.com/x', title: 'Example' })])
  })

  it('skips rows without a usable http url', () => {
    const parsed = parseCsvBookmarks(
      'url,title\njavascript:alert(1),nope\nnot a url,bad\nhttps://example.com/ok,ok\n',
    )
    expect(parsed).toHaveLength(1)
    expect(parsed[0].url).toBe('https://example.com/ok')
  })

  it('returns nothing when there is no url column', () => {
    expect(parseCsvBookmarks('a,b\n1,2\n')).toEqual([])
  })
})

describe('parseEnexBookmarks', () => {
  it('parses notes with source-url, tags, dates, and skips notes without links', () => {
    const parsed = parseEnexBookmarks(ENEX)

    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toEqual(
      bookmark({
        url: 'https://www.readthistwice.com/person/paul-graham',
        title: 'Paul Graham books',
        notes: '89 books & quotes worth reading.',
        tags: ['books', 'Read Later'],
        createdAt: new Date(Date.UTC(2020, 0, 2, 3, 4, 5)),
      }),
    )
    expect(parsed[1]).toEqual(
      bookmark({
        url: 'https://www.typescriptlang.org/docs/',
        title: 'TypeScript handbook',
        notes: 'Link: handbook',
        tags: ['types'],
        createdAt: new Date(Date.UTC(2020, 0, 3)),
      }),
    )
  })
})

describe('parseTxtBookmarks', () => {
  it('accepts bare urls, url plus title, comments, and junk lines', () => {
    const parsed = parseTxtBookmarks(
      [
        '# my links',
        'https://example.com/one',
        'https://example.com/two Two title',
        'just some prose',
        '',
        'ftp://example.com/nope',
      ].join('\n'),
    )

    expect(parsed).toEqual([
      bookmark({ url: 'https://example.com/one' }),
      bookmark({ url: 'https://example.com/two', title: 'Two title' }),
    ])
  })
})

describe('parseImportFile', () => {
  it('sniffs html, csv, enex, and falls back to txt', () => {
    expect(parseImportFile(RAINDROP_CSV, 'export.csv')).toHaveLength(2)
    expect(parseImportFile(ENEX, 'notes.enex')).toHaveLength(2)
    expect(
      parseImportFile('<DL><p><DT><A HREF="https://example.com/h">H</A></DL><p>'),
    ).toHaveLength(1)
    expect(parseImportFile('https://example.com/plain\n')).toHaveLength(1)
  })

  it('trusts content over a misleading extension', () => {
    expect(parseImportFile(ENEX, 'notes.txt')).toHaveLength(2)
    expect(parseImportFile(RAINDROP_CSV, 'bookmarks.html')).toHaveLength(2)
  })
})
