import { createServerFn } from '@tanstack/react-start'
import { archiveBookmarkPage, getAutoArchive, setAutoArchive } from '~/lib/archive.server'
import { createHighlight, deleteHighlight, listHighlights } from '~/lib/highlights.server'
import { getInsights } from '~/lib/insights.server'
import { readBookmarkPage } from '~/lib/reader.server'
import {
  createSavedSearch,
  deleteSavedSearch,
  listSavedSearches,
} from '~/lib/saved-searches.server'
import {
  createShareLink,
  listShareLinks,
  revokeShareLink,
} from '~/lib/share-links.server'
import { requireSession } from '~/lib/require-session'
import { discardPendingTwoFactor } from '~/lib/two-factor.server'
import { asRecord, requireString } from '~/lib/validate'

export const archiveBookmark = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => ({ id: requireString(input, 'id') }))
  .handler(async ({ data }) => archiveBookmarkPage(data.id))

export const autoArchive = createServerFn({ method: 'GET' })
  .middleware([requireSession])
  .handler(async () => ({ enabled: await getAutoArchive() }))

export const saveAutoArchive = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => ({ enabled: asRecord(input).enabled === true }))
  .handler(async ({ data }) => ({ enabled: await setAutoArchive(data.enabled) }))

export const readBookmark = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => ({ id: requireString(input, 'id') }))
  .handler(async ({ data }) => readBookmarkPage(data.id))

export const insights = createServerFn({ method: 'GET' })
  .middleware([requireSession])
  .handler(async () => getInsights())

export const getSavedSearches = createServerFn({ method: 'GET' })
  .middleware([requireSession])
  .handler(async () => listSavedSearches())

export const saveSearch = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => {
    const record = asRecord(input)
    const query = asRecord(record.query ?? {})
    const text = (key: string) =>
      typeof query[key] === 'string' && query[key] ? (query[key] as string) : undefined
    return {
      name: requireString(input, 'name'),
      query: {
        status:
          text('status') === 'archived' ? ('archived' as const) : ('active' as const),
        q: text('q'),
        tag: text('tag'),
        collection: text('collection'),
        sort: text('sort') as
          'newest' | 'oldest' | 'title-asc' | 'title-desc' | 'manual' | undefined,
      },
    }
  })
  .handler(async ({ data }) => createSavedSearch(data.name, data.query))

export const removeSavedSearch = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => ({ id: requireString(input, 'id') }))
  .handler(async ({ data }) => {
    await deleteSavedSearch(data.id)
    return { id: data.id }
  })

export const getShareLinks = createServerFn({ method: 'GET' })
  .middleware([requireSession])
  .validator((input: unknown) => ({ id: requireString(input, 'id') }))
  .handler(async ({ data }) => listShareLinks(data.id))

export const createShare = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => {
    const record = asRecord(input)
    const expiresInDays = record.expiresInDays
    if (
      expiresInDays !== undefined &&
      expiresInDays !== null &&
      typeof expiresInDays !== 'number'
    ) {
      throw new Error('Expected "expiresInDays" to be a number or null')
    }
    return {
      id: requireString(input, 'id'),
      expiresInDays: (expiresInDays as number | null | undefined) ?? null,
    }
  })
  .handler(async ({ data }) => createShareLink(data.id, data.expiresInDays))

export const revokeShare = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => ({ id: requireString(input, 'id') }))
  .handler(async ({ data }) => {
    await revokeShareLink(data.id)
    return { id: data.id }
  })

export const getHighlights = createServerFn({ method: 'GET' })
  .middleware([requireSession])
  .validator((input: unknown) => ({ id: requireString(input, 'id') }))
  .handler(async ({ data }) => listHighlights(data.id))

export const addHighlight = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => {
    const record = asRecord(input)
    const note = record.note
    if (note !== undefined && note !== null && typeof note !== 'string') {
      throw new Error('Expected "note" to be a string')
    }
    return {
      id: requireString(input, 'id'),
      quote: requireString(input, 'quote'),
      note: (note as string | null | undefined) ?? null,
    }
  })
  .handler(async ({ data }) => createHighlight(data.id, data.quote, data.note))

export const removeHighlight = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => ({ id: requireString(input, 'id') }))
  .handler(async ({ data }) => {
    await deleteHighlight(data.id)
    return { id: data.id }
  })

export const discardTwoFactorSetup = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .handler(async ({ context }) => ({
    removed: await discardPendingTwoFactor(context.session.user.id),
  }))
