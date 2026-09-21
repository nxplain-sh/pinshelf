import { beforeAll, describe, expect, it } from 'vitest'
import {
  handleCreateBookmark,
  handleDeleteBookmark,
  handleGetBookmark,
  handleListBookmarks,
  handleListTags,
  handleUpdateBookmark,
} from '../src/lib/api-handlers.server'
import { auth } from '../src/lib/auth.server'
import { createBookmarkRecord } from '../src/lib/bookmarks.server'

let token = ''
let ownerId = ''

function request(
  path: string,
  init: RequestInit & { anonymous?: boolean } = {},
): Request {
  const { anonymous, ...rest } = init
  const headers = new Headers(rest.headers)
  headers.set('content-type', 'application/json')
  if (!anonymous && !headers.has('authorization')) {
    headers.set('authorization', `Bearer ${token}`)
  }
  return new Request(`http://pinshelf.test${path}`, { ...rest, headers })
}

beforeAll(async () => {
  const created = await auth.api.signUpEmail({
    body: { name: 'Owner', email: 'owner@test.local', password: 'test-password-123' },
  })
  const key = await auth.api.createApiKey({
    body: {
      name: 'integration',
      userId: created.user.id,
      rateLimitEnabled: false,
    },
  })
  token = key.key
  ownerId = created.user.id
})

describe('authentication', () => {
  it('rejects requests without a token', async () => {
    const response = await handleListBookmarks(
      request('/api/bookmarks', { anonymous: true }),
    )
    expect(response.status).toBe(401)
  })

  it('rejects requests with an invalid token', async () => {
    const response = await handleListBookmarks(
      request('/api/bookmarks', { headers: { authorization: 'Bearer nope' } }),
    )
    expect(response.status).toBe(401)
  })

  it('lets a read-only token read but not write', async () => {
    const readOnly = await auth.api.createApiKey({
      body: {
        name: 'read-only',
        userId: ownerId,
        permissions: { bookmarks: ['read'] },
        rateLimitEnabled: false,
      },
    })

    const read = await handleListBookmarks(
      request('/api/bookmarks', {
        headers: { authorization: `Bearer ${readOnly.key}` },
      }),
    )
    expect(read.status).toBe(200)

    const write = await handleCreateBookmark(
      request('/api/bookmarks', {
        method: 'POST',
        headers: { authorization: `Bearer ${readOnly.key}` },
        body: JSON.stringify({ url: 'https://example.com/read-only-test' }),
      }),
    )
    expect(write.status).toBe(403)
  })
})

describe('bookmark lifecycle', () => {
  it('creates a bookmark with metadata, tags, and notes', async () => {
    const response = await handleCreateBookmark(
      request('/api/bookmarks', {
        method: 'POST',
        body: JSON.stringify({
          url: 'https://www.example.com/?utm_source=test',
          tags: ['React', 'frontend'],
          notes: 'from the test',
        }),
      }),
    )

    expect(response.status).toBe(201)
    const body = (await response.json()) as {
      bookmark: { id: string; url: string; title: string; metadataStatus: string }
      duplicate: boolean
    }
    expect(body.duplicate).toBe(false)
    expect(body.bookmark.url).toBe('https://example.com/')
    expect(body.bookmark.title).toBe('Example Domain')
    expect(body.bookmark.metadataStatus).toBe('done')
  })

  it('treats tracking-parameter variants as duplicates', async () => {
    const response = await handleCreateBookmark(
      request('/api/bookmarks', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://example.com/?fbclid=abc' }),
      }),
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as { duplicate: boolean }
    expect(body.duplicate).toBe(true)
  })

  it('rejects invalid urls and malformed bodies', async () => {
    const badUrl = await handleCreateBookmark(
      request('/api/bookmarks', {
        method: 'POST',
        body: JSON.stringify({ url: 'ftp://example.com/file' }),
      }),
    )
    expect(badUrl.status).toBe(400)

    const badJson = await handleCreateBookmark(
      request('/api/bookmarks', { method: 'POST', body: '{oops' }),
    )
    expect(badJson.status).toBe(400)

    const missingUrl = await handleCreateBookmark(
      request('/api/bookmarks', { method: 'POST', body: JSON.stringify({}) }),
    )
    expect(missingUrl.status).toBe(400)
  })

  it('finds bookmarks by title, tag, and notes', async () => {
    const byTitle = await handleListBookmarks(request('/api/bookmarks?q=domain'))
    expect(await count(byTitle)).toBe(1)

    const byTag = await handleListBookmarks(request('/api/bookmarks?tag=react'))
    expect(await count(byTag)).toBe(1)

    const byNotes = await handleListBookmarks(
      request('/api/bookmarks?q=from%20the%20test'),
    )
    expect(await count(byNotes)).toBe(1)

    const noMatch = await handleListBookmarks(request('/api/bookmarks?q=zzzznope'))
    expect(await count(noMatch)).toBe(0)
  })

  it('updates fields and moves through trash and back', async () => {
    const id = await firstBookmarkId()

    const patch = await handleUpdateBookmark(
      request(`/api/bookmarks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Renamed', tags: ['only'], status: 'trashed' }),
      }),
      id,
    )
    expect(patch.status).toBe(200)

    const trashed = await handleListBookmarks(request('/api/bookmarks?status=trashed'))
    expect(await count(trashed)).toBe(1)

    const active = await handleListBookmarks(request('/api/bookmarks?status=active'))
    expect(await count(active)).toBe(0)

    const tags = await handleListTags(request('/api/tags'))
    const tagBody = (await tags.json()) as { tags: { name: string }[] }
    expect(tagBody.tags.map((tag) => tag.name)).toEqual(['only'])

    const empty = await handleUpdateBookmark(
      request(`/api/bookmarks/${id}`, { method: 'PATCH', body: '{}' }),
      id,
    )
    expect(empty.status).toBe(400)

    const restored = await handleUpdateBookmark(
      request(`/api/bookmarks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'active' }),
      }),
      id,
    )
    expect(restored.status).toBe(200)
  })

  it('reads and deletes a single bookmark', async () => {
    const id = await firstBookmarkId()

    const get = await handleGetBookmark(request(`/api/bookmarks/${id}`), id)
    expect(get.status).toBe(200)

    const deleted = await handleDeleteBookmark(
      request(`/api/bookmarks/${id}`, { method: 'DELETE' }),
      id,
    )
    expect(deleted.status).toBe(200)

    const gone = await handleGetBookmark(request(`/api/bookmarks/${id}`), id)
    expect(gone.status).toBe(404)
  })

  it('refuses to fetch private hosts but still saves the bookmark', async () => {
    const response = await handleCreateBookmark(
      request('/api/bookmarks', {
        method: 'POST',
        body: JSON.stringify({ url: 'http://127.0.0.1/admin' }),
      }),
    )

    expect(response.status).toBe(201)
    const body = (await response.json()) as {
      bookmark: { id: string; metadataStatus: string }
    }
    expect(body.bookmark.metadataStatus).toBe('failed')
  })
})

describe('collection filter', () => {
  it('filters by collection and by unsorted', async () => {
    const created = await createBookmarkRecord({ url: 'https://example.com/collected' })
    expect(created.bookmark).not.toBeNull()

    const { db } = await import('../src/db/index.server')
    const { collections, bookmarks } = await import('../src/db/schema')
    const { eq } = await import('drizzle-orm')

    const now = new Date()
    const [collection] = await db
      .insert(collections)
      .values({
        id: crypto.randomUUID(),
        name: 'Dev',
        nameKey: 'dev',
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    await db
      .update(bookmarks)
      .set({ collectionId: collection.id })
      .where(eq(bookmarks.id, created.bookmark?.id ?? ''))

    const inCollection = await handleListBookmarks(
      request(`/api/bookmarks?collection=${collection.id}`),
    )
    expect(await count(inCollection)).toBe(1)

    const unsorted = await handleListBookmarks(
      request('/api/bookmarks?collection=unsorted'),
    )
    expect(await count(unsorted)).toBe(1)
  })
})

async function count(response: Response): Promise<number> {
  const body = (await response.json()) as { bookmarks: unknown[] }
  return body.bookmarks.length
}

async function firstBookmarkId(): Promise<string> {
  const response = await handleListBookmarks(request('/api/bookmarks?status=active'))
  const body = (await response.json()) as { bookmarks: { id: string }[] }
  const id = body.bookmarks[0]?.id
  if (!id) throw new Error('no bookmark available in test state')
  return id
}
