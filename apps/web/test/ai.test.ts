import { describe, expect, it, beforeAll } from 'vitest'
import {
  applyProposals,
  callAi,
  getAiConfig,
  getAiSettingsView,
  parseAiProposals,
  sanitizeProposals,
  saveAiSettings,
  scanForCleanup,
} from '../src/lib/ai.server'
import type { CleanupCandidate } from '../src/lib/ai-schemas'
import { createBookmarkRecord, getBookmarkById } from '../src/lib/bookmarks.server'
import { parseStrictJson } from '../src/lib/ai.server'
import { createSavedSearch } from '../src/lib/saved-searches.server'
import {
  interpretSearch,
  sanitizeSmartFilter,
  suggestSmartCollections,
} from '../src/lib/smart.server'

const candidate = (
  overrides: Partial<CleanupCandidate> & { id: string },
): CleanupCandidate => ({
  url: `https://example.com/${overrides.id}`,
  title: null,
  description: null,
  tags: [],
  collection: null,
  ...overrides,
})

describe('ai settings', () => {
  it('stores the key and never returns it to the client', async () => {
    await saveAiSettings({
      baseUrl: 'https://ai.test/v1/',
      model: 'test-model',
      apiKey: 'secret-key-abcd',
    })

    const config = await getAiConfig()
    expect(config).toEqual({
      baseUrl: 'https://ai.test/v1',
      apiKey: 'secret-key-abcd',
      model: 'test-model',
    })

    const view = await getAiSettingsView()
    expect(view).toEqual({
      baseUrl: 'https://ai.test/v1',
      model: 'test-model',
      hasApiKey: true,
      apiKeyHint: '…abcd',
    })
    expect(JSON.stringify(view)).not.toContain('secret-key-abcd')
  })

  it('keeps the stored key when saving without a new one', async () => {
    await saveAiSettings({ baseUrl: 'https://ai.test/v1', model: 'other-model' })
    const config = await getAiConfig()
    expect(config?.model).toBe('other-model')
    expect(config?.apiKey).toBe('secret-key-abcd')
  })

  it('allows a local endpoint, which is the point of custom providers', async () => {
    await saveAiSettings({ baseUrl: 'http://127.0.0.1:11434/v1', model: 'local' })
    const error = await callAi([{ role: 'user', content: 'hi' }]).catch(
      (cause: unknown) => cause,
    )
    // The stub answers 502 for unknown hosts; what matters is that the request
    // left the worker instead of being refused by the private-host guard.
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).not.toContain('Refusing to call private host')
  })
})

describe('parseAiProposals', () => {
  it('accepts plain json and fenced json', () => {
    const json = JSON.stringify({
      duplicates: [{ keepId: 'a', removeIds: ['b'], reason: 'same' }],
      updates: [{ id: 'c', tags: ['x'] }],
    })
    expect(parseAiProposals(json).duplicates).toHaveLength(1)
    expect(parseAiProposals(`\`\`\`json\n${json}\n\`\`\``).updates).toHaveLength(1)
  })

  it('fills missing sections with empty arrays', () => {
    expect(parseAiProposals('{}')).toEqual({ duplicates: [], updates: [] })
  })

  it('rejects responses that are not json', () => {
    expect(() => parseAiProposals('I could not help with that')).toThrow('not valid JSON')
  })
})

describe('sanitizeProposals', () => {
  it('drops unknown ids and keeps the keeper out of removeIds', () => {
    const proposals = sanitizeProposals(
      {
        duplicates: [
          { keepId: 'a', removeIds: ['a', 'b', 'ghost'] },
          { keepId: 'ghost', removeIds: ['a'] },
        ],
        updates: [
          { id: 'a', tags: ['x'] },
          { id: 'ghost', tags: ['y'] },
        ],
      },
      [candidate({ id: 'a' }), candidate({ id: 'b' })],
    )

    expect(proposals.duplicates).toEqual([
      { keepId: 'a', removeIds: ['b'], reason: undefined },
    ])
    expect(proposals.updates).toEqual([{ id: 'a', tags: ['x'] }])
  })
})

describe('scan and apply', () => {
  beforeAll(async () => {
    await saveAiSettings({
      baseUrl: 'https://ai.test/v1',
      model: 'test-model',
      apiKey: 'secret-key-abcd',
    })
  })

  it('scans, proposes, and applies duplicates plus metadata', async () => {
    const first = await createBookmarkRecord({ url: 'https://example.com/ai-one' })
    const second = await createBookmarkRecord({ url: 'https://example.com/ai-two' })
    const third = await createBookmarkRecord({ url: 'https://example.com/ai-three' })

    const ids = [first.bookmark?.id, second.bookmark?.id, third.bookmark?.id]
    expect(ids.every(Boolean)).toBe(true)

    const scan = await scanForCleanup(50)
    expect(scan.scanned).toBe(3)
    expect(scan.proposals.duplicates).toHaveLength(1)
    expect(scan.proposals.duplicates[0].removeIds).toEqual([ids[1]])
    expect(scan.proposals.updates[0].id).toBe(ids[2])

    const summary = await applyProposals(scan.proposals)
    expect(summary).toEqual({ trashed: 1, updated: 1, collectionsCreated: 1 })

    const trashed = await getBookmarkById(ids[1] as string)
    expect(trashed?.status).toBe('trashed')

    const updated = await getBookmarkById(ids[2] as string)
    expect(updated?.tags).toEqual(['ai-tag'])
    expect(updated?.description).toBe('AI description')
    expect(updated?.collectionName).toBe('AI Collection')

    const keeper = await getBookmarkById(ids[0] as string)
    expect(keeper?.status).toBe('active')
  })

  it('tidy mode scans only bookmarks without a collection', async () => {
    // The previous test left one active bookmark without a collection; the
    // trashed one and the one filed under "AI Collection" are out of scope.
    const scan = await scanForCleanup(50, { onlyUnsorted: true })
    expect(scan.scanned).toBe(1)
    expect(scan.unassigned).toBe(1)
  })
})

describe('smart filters and collections', () => {
  it('turns a request into filters', async () => {
    const filter = await interpretSearch('rust things, newest first')
    expect(filter.q).toBe('rust')
    expect(filter.sort).toBe('newest')
    expect(filter.status).toBe('active')
  })

  it('drops tags and collections the library does not have', () => {
    const filter = sanitizeSmartFilter(
      { q: 'x', tag: 'not-a-real-tag', collection: 'nope' },
      { tags: ['rust'], collections: ['reading'] },
    )
    expect(filter?.tag).toBeUndefined()
    expect(filter?.collection).toBeUndefined()
    expect(filter?.q).toBe('x')
  })

  it('returns null when nothing usable is left', () => {
    expect(
      sanitizeSmartFilter({ tag: 'ghost' }, { tags: [], collections: [] }),
    ).toBeNull()
    expect(sanitizeSmartFilter('nonsense', { tags: [], collections: [] })).toBeNull()
    expect(sanitizeSmartFilter({ q: '   ' }, { tags: [], collections: [] })).toBeNull()
  })

  it('keeps only suggestions that filter by something real, once each', async () => {
    const items = await suggestSmartCollections(4)
    expect(items.length).toBeGreaterThan(0)
    expect(items[0].name).toBe('ai picks')
    // The stub proposes the same name twice and one unknown tag: both go.
    expect(items.filter((item) => item.name === 'ai picks')).toHaveLength(1)
    expect(items.some((item) => item.tag === 'not-a-real-tag')).toBe(false)
  })

  it('skips suggestions that repeat an existing saved search', async () => {
    await createSavedSearch('ai picks', { status: 'active', q: 'x' })
    const items = await suggestSmartCollections(4)
    expect(items.some((item) => item.name === 'ai picks')).toBe(false)
  })

  it('strips control characters and collapses whitespace in filters', () => {
    const filter = sanitizeSmartFilter(
      { q: 'rust\u0000  async\n\nlifetimes' },
      { tags: [], collections: [] },
    )
    expect(filter?.q).toBe('rust async lifetimes')
  })

  it('refuses oversized model output before parsing', () => {
    expect(() => parseStrictJson('x'.repeat(200_001))).toThrow('not valid JSON')
  })
})
