import { describe, expect, it } from 'vitest'
import { looksLikePinshelfJson, parsePinshelfJson } from './backup'
import { parseImportFile } from './import'
import { toNetscapeHtml } from './netscape'

const BACKUP = JSON.stringify({
  version: 1,
  exportedAt: '2026-09-20T12:00:00.000Z',
  collections: ['Dev'],
  bookmarks: [
    {
      url: 'https://example.com/one',
      title: 'One',
      description: 'desc',
      notes: 'note',
      tags: ['a', 'b'],
      collection: 'Dev',
      status: 'active',
      createdAt: '2026-01-02T03:04:05.000Z',
    },
    {
      url: 'https://example.com/two',
      title: null,
      description: null,
      notes: null,
      tags: [],
      collection: null,
      status: 'trashed',
      createdAt: null,
    },
  ],
})

describe('parsePinshelfJson', () => {
  it('reads the export format, including status and dates', () => {
    const parsed = parsePinshelfJson(BACKUP)

    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toEqual({
      url: 'https://example.com/one',
      title: 'One',
      description: 'desc',
      notes: 'note',
      tags: ['a', 'b'],
      collection: 'Dev',
      createdAt: new Date('2026-01-02T03:04:05.000Z'),
      status: 'active',
    })
    expect(parsed[1].status).toBe('trashed')
    expect(parsed[1].createdAt).toBeNull()
  })

  it('skips entries without a usable url and tolerates junk fields', () => {
    const parsed = parsePinshelfJson(
      JSON.stringify({
        version: 1,
        bookmarks: [
          { url: 'javascript:alert(1)' },
          { url: 'not a url' },
          { url: 'https://example.com/ok', tags: [1, 'kept', null] },
        ],
      }),
    )

    expect(parsed).toHaveLength(1)
    expect(parsed[0].tags).toEqual(['kept'])
  })

  it('rejects files that are not json or carry no bookmarks', () => {
    expect(() => parsePinshelfJson('nope')).toThrow('not valid JSON')
    expect(() => parsePinshelfJson('{"version":1}')).toThrow('no bookmarks array')
  })
})

describe('format detection', () => {
  it('picks the json reader for a backup and html for a netscape file', () => {
    expect(looksLikePinshelfJson(BACKUP)).toBe(true)
    expect(looksLikePinshelfJson('<DL><p></DL><p>')).toBe(false)

    const html = toNetscapeHtml([
      {
        url: 'https://example.com/x',
        title: 'X',
        description: null,
        tags: [],
        collection: null,
        createdAt: null,
      },
    ])

    expect(parseImportFile(BACKUP, 'pinshelf-backup.json')).toHaveLength(2)
    expect(parseImportFile(html, 'bookmarks.html')).toHaveLength(1)
  })
})
