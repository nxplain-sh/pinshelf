import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { aiProposalSchema } from '~/lib/ai-schemas'
import {
  applyProposals,
  callAi,
  clearAiApiKey,
  getAiSettingsView,
  saveAiSettings,
  scanForCleanup,
} from '~/lib/ai.server'
import { asRecord, optionalString, requireString } from '~/lib/validate'
import { requireSession } from '~/lib/require-session'
import {
  interpretSearch,
  suggestSmartCollections as suggestCollections,
} from '~/lib/smart.server'

function httpUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('Base URL must be a valid URL, for example https://api.openai.com/v1')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Base URL must use http or https')
  }
  return value
}

export const getAiSettings = createServerFn({ method: 'GET' })
  .middleware([requireSession])
  .handler(async () => {
    return getAiSettingsView()
  })

export const saveAiSettingsFn = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => ({
    baseUrl: httpUrl(requireString(input, 'baseUrl')),
    model: requireString(input, 'model'),
    apiKey: optionalString(input, 'apiKey'),
  }))
  .handler(async ({ data }) => saveAiSettings(data))

export const clearAiKey = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .handler(async () => {
    return clearAiApiKey()
  })

export const testAiConnection = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .handler(async () => {
    const reply = await callAi([
      {
        role: 'system',
        content: 'You are a health check. Reply with the single word: ok',
      },
      { role: 'user', content: 'ping' },
    ])
    return { reply: reply.trim().slice(0, 120) }
  })

export const scanCleanup = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => {
    const record = asRecord(input)
    const limit = record.limit
    if (limit === undefined) {
      return { limit: 50, onlyUnsorted: record.onlyUnsorted === true }
    }
    if (typeof limit !== 'number' || !Number.isFinite(limit)) {
      throw new Error('Expected "limit" to be a number')
    }
    return {
      limit: Math.min(Math.max(Math.trunc(limit), 1), 500),
      onlyUnsorted: record.onlyUnsorted === true,
    }
  })
  .handler(async ({ data }) =>
    scanForCleanup(data.limit, { onlyUnsorted: data.onlyUnsorted }),
  )

export const applyCleanup = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => {
    const parsed = aiProposalSchema.safeParse(asRecord(input).proposals)
    if (!parsed.success) throw new Error(z.prettifyError(parsed.error))
    return parsed.data
  })
  .handler(async ({ data }) => applyProposals(data))

export const smartSearch = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => {
    const text = requireString(input, 'text')
    if (text.length > 500) {
      throw new Error('Keep the request under 500 characters')
    }
    return { text }
  })
  .handler(async ({ data }) => interpretSearch(data.text))

export const suggestSmartCollections = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => {
    const limit = asRecord(input).limit
    if (limit === undefined) return { limit: 4 }
    if (typeof limit !== 'number' || !Number.isFinite(limit)) {
      throw new Error('Expected "limit" to be a number')
    }
    return { limit: Math.min(Math.max(Math.trunc(limit), 1), 8) }
  })
  .handler(async ({ data }) => suggestCollections(data.limit))
