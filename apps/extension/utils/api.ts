import { apiBaseUrl, apiToken } from './settings'

export type SaveResult = {
  bookmark: { id: string; url: string; title: string | null }
  duplicate: boolean
}

export type Collection = { id: string; name: string; bookmarkCount: number }

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number }

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const [base, token] = await Promise.all([apiBaseUrl.getValue(), apiToken.getValue()])

  if (!token) {
    return { ok: false, error: 'no API token configured', status: 0 }
  }

  let response: Response
  try {
    response = await fetch(`${base.replace(/\/+$/, '')}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    })
  } catch {
    return { ok: false, error: `cannot reach ${base}`, status: 0 }
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    return {
      ok: false,
      error: body?.error ?? response.statusText,
      status: response.status,
    }
  }

  return { ok: true, data: (await response.json()) as T }
}

export function saveBookmark(input: {
  url: string
  tags?: string[]
  notes?: string
  collectionId?: string | null
}) {
  return request<SaveResult>('/api/bookmarks', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function fetchCollections() {
  return request<{ collections: Collection[] }>('/api/collections')
}
