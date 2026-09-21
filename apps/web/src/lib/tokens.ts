import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from '~/lib/auth.server'
import { requireString } from '~/lib/validate'
import { requireSession } from '~/lib/require-session'

export type ApiTokenSummary = {
  id: string
  name: string | null
  start: string | null
  createdAt: Date
  lastRequest: Date | null
  expiresAt: Date | null
  readOnly: boolean
}

function isReadOnly(permissions: unknown): boolean {
  const raw =
    typeof permissions === 'string'
      ? (() => {
          try {
            return JSON.parse(permissions) as Record<string, string[]>
          } catch {
            return null
          }
        })()
      : (permissions as Record<string, string[]> | null)
  if (!raw || typeof raw !== 'object') return false
  const actions = Object.values(raw).flat()
  return actions.includes('read') && !actions.includes('write')
}

export const listApiTokens = createServerFn({ method: 'GET' })
  .middleware([requireSession])
  .handler(async (): Promise<ApiTokenSummary[]> => {
    const { apiKeys } = await auth.api.listApiKeys({ headers: getRequestHeaders() })
    return apiKeys.map((key) => ({
      id: key.id,
      name: key.name ?? null,
      start: key.start ?? null,
      createdAt: key.createdAt,
      lastRequest: key.lastRequest ?? null,
      expiresAt: key.expiresAt ?? null,
      readOnly: isReadOnly(key.permissions),
    }))
  })

export const createApiToken = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => {
    const record = (input ?? {}) as Record<string, unknown>
    const expiresInDays = record.expiresInDays
    if (
      expiresInDays !== undefined &&
      expiresInDays !== null &&
      typeof expiresInDays !== 'number'
    ) {
      throw new Error('Expected "expiresInDays" to be a number or null')
    }
    return {
      name: requireString(input, 'name'),
      expiresInDays: (expiresInDays as number | null | undefined) ?? null,
      readOnly: record.readOnly === true,
    }
  })
  .handler(async ({ data }) => {
    const created = await auth.api.createApiKey({
      headers: getRequestHeaders(),
      body: {
        name: data.name,
        permissions: {
          bookmarks: data.readOnly ? ['read'] : ['read', 'write'],
        },
        expiresIn: data.expiresInDays
          ? Math.round(data.expiresInDays * 24 * 60 * 60)
          : undefined,
      },
    })
    return {
      id: created.id,
      name: created.name ?? null,
      key: created.key,
    }
  })

export const revokeApiToken = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => ({ keyId: requireString(input, 'keyId') }))
  .handler(async ({ data }) => {
    await auth.api.deleteApiKey({
      headers: getRequestHeaders(),
      body: { keyId: data.keyId },
    })
    return { keyId: data.keyId }
  })
