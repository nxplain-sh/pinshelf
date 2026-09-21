import { beforeAll, describe, expect, it } from 'vitest'
import { archiveBookmarkPage, readArchive } from '../src/lib/archive.server'
import { createBookmarkRecord } from '../src/lib/bookmarks.server'
import {
  createHighlight,
  deleteHighlight,
  listHighlights,
} from '../src/lib/highlights.server'
import { getInsights } from '../src/lib/insights.server'
import {
  createShareLink,
  listShareLinks,
  resolveShareToken,
  revokeShareLink,
} from '../src/lib/share-links.server'

let bookmarkId = ''

beforeAll(async () => {
  const created = await createBookmarkRecord({ url: 'https://example.com/archive-me' })
  bookmarkId = created.bookmark?.id ?? ''
})

describe('page archive', () => {
  it('stores the fetched page in R2 and records the key', async () => {
    const result = await archiveBookmarkPage(bookmarkId)
    expect(result.status).toBe('done')
    expect(result.key).toBe(`archives/${bookmarkId}.html`)

    const object = await readArchive(result.key ?? '')
    expect(await object?.text()).toContain('Example Domain')
  })

  it('fails cleanly for a bookmark that does not exist', async () => {
    await expect(archiveBookmarkPage('missing-id')).rejects.toThrow('Bookmark not found')
  })
})

describe('share links', () => {
  it('resolves a live token and rejects a revoked one', async () => {
    const link = await createShareLink(bookmarkId, null)
    expect(await resolveShareToken(link.token)).toBe(bookmarkId)

    await revokeShareLink(link.id)
    expect(await resolveShareToken(link.token)).toBeNull()
  })

  it('rejects an expired token', async () => {
    const link = await createShareLink(bookmarkId, -1)
    expect(await resolveShareToken(link.token)).toBeNull()
  })

  it('lists only live links for the bookmark', async () => {
    const before = await listShareLinks(bookmarkId)
    const link = await createShareLink(bookmarkId, null)
    const after = await listShareLinks(bookmarkId)
    expect(after.length).toBe(before.length + 1)
    expect(after.some((row) => row.id === link.id)).toBe(true)
  })
})

describe('insights', () => {
  it('counts active bookmarks and how many have no collection', async () => {
    const data = await getInsights()
    expect(data.counts.active).toBeGreaterThan(0)
    expect(data.counts.unsorted).toBeGreaterThan(0)
    expect(data.counts.unsorted).toBeLessThanOrEqual(data.counts.active)
  })
})

describe('highlights', () => {
  it('stores a quote with its note and deletes it again', async () => {
    const highlight = await createHighlight(
      bookmarkId,
      '  the line worth keeping  ',
      'why',
    )
    expect(highlight.quote).toBe('the line worth keeping')
    expect(highlight.note).toBe('why')

    const listed = await listHighlights(bookmarkId)
    expect(listed.some((row) => row.id === highlight.id)).toBe(true)

    await deleteHighlight(highlight.id)
    expect(
      (await listHighlights(bookmarkId)).some((row) => row.id === highlight.id),
    ).toBe(false)
  })

  it('refuses an empty quote', async () => {
    await expect(createHighlight(bookmarkId, '   ', null)).rejects.toThrow(
      'A highlight needs some text',
    )
  })
})
