import { describe, expect, it } from 'vitest'
import { toMarkdown } from './markdown'

const base = {
  url: 'https://example.com/article',
  title: 'An *article* [draft]',
  description: null,
  tags: [],
  collection: null,
  createdAt: new Date('2026-03-01T12:00:00.000Z'),
}

describe('toMarkdown', () => {
  it('writes a bullet with metadata for a plain bookmark', () => {
    const output = toMarkdown([base])
    expect(output).toContain('# pinshelf')
    expect(output).toContain('1 bookmarks')
    expect(output).toContain(
      '- [An \\*article\\* \\[draft\\]](https://example.com/article)',
    )
    expect(output).toContain('  saved: 2026-03-01')
  })

  it('adds tags, collection, notes, and a trashed marker', () => {
    const output = toMarkdown([
      {
        ...base,
        tags: ['rust', 'async'],
        collection: 'reading',
        notes: 'read later',
        status: 'trashed',
      },
    ])
    expect(output).toContain('tags: rust, async · collection: reading · trashed')
    expect(output).toContain('  notes: read later')
  })

  it('falls back to the url when there is no title and no date', () => {
    const output = toMarkdown([
      { ...base, title: null, createdAt: null, description: 'a page' },
    ])
    expect(output).toContain(
      '- [https://example.com/article](https://example.com/article)',
    )
    expect(output).toContain('saved: unknown')
    expect(output).toContain('  a page')
  })
})
