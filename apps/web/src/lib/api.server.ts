import { z } from 'zod'
import { auth } from '~/lib/auth.server'

export function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 })
}

export function badRequestFromZod(error: z.ZodError) {
  return badRequest(z.prettifyError(error))
}

export function notFound(message = 'not found') {
  return Response.json({ error: message }, { status: 404 })
}

function unauthorized(message: string) {
  return Response.json({ error: message }, { status: 401 })
}

function forbidden(message: string) {
  return Response.json({ error: message }, { status: 403 })
}

export type ApiScope = 'read' | 'write'

function permissionsOf(apiKey: unknown): Record<string, string[]> | null {
  const raw = (apiKey as { permissions?: unknown } | null)?.permissions
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, string[]>
    } catch {
      return null
    }
  }
  if (typeof raw === 'object') return raw as Record<string, string[]>
  return null
}

function hasScope(apiKey: unknown, scope: ApiScope): boolean {
  const permissions = permissionsOf(apiKey)
  // Keys with no permissions recorded keep full access: that covers tokens
  // created before scopes existed, and any future admin-style key.
  if (!permissions || Object.keys(permissions).length === 0) return true
  return Object.values(permissions).some(
    (actions) => Array.isArray(actions) && actions.includes(scope),
  )
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? ''
  if (!header.toLowerCase().startsWith('bearer ')) return null
  const token = header.slice(7).trim()
  return token || null
}

export async function authorizeApiRequest(
  request: Request,
  scope: ApiScope = 'read',
): Promise<Response | null> {
  const token = bearerToken(request)
  if (!token) return unauthorized('missing bearer token')

  const result = await auth.api.verifyApiKey({ body: { key: token } })
  if (!result?.valid) return unauthorized('invalid api key')
  if (!hasScope(result.key, scope)) return forbidden('this token is read-only')

  return null
}

export async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown> | Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest('invalid JSON body')
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return badRequest('expected a JSON object body')
  }
  return body as Record<string, unknown>
}
