import { isBlockedHostname } from '@pinshelf/shared'

export type Metadata = {
  title?: string
  description?: string
  siteName?: string
  faviconUrl?: string
  ogImageUrl?: string
}

const USER_AGENT = 'Mozilla/5.0 (compatible; pinshelf/0.1; +https://app.pinshelf.app)'
const MAX_LENGTH = 500
const TIMEOUT_MS = 8000
const MAX_REDIRECTS = 5

function clean(value: string | undefined): string | undefined {
  if (!value) return undefined
  const collapsed = value.replace(/\s+/g, ' ').trim()
  return collapsed ? collapsed.slice(0, MAX_LENGTH) : undefined
}

function absolute(value: string | undefined, base: string): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value.trim(), base)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

export async function fetchHtml(url: string): Promise<Response> {
  let current = new URL(url)

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (isBlockedHostname(current.hostname)) {
      throw new Error(`Refusing to fetch private host: ${current.hostname}`)
    }

    const response = await fetch(current, {
      redirect: 'manual',
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    const location = response.headers.get('location')
    const redirecting =
      response.status >= 300 && response.status < 400 && Boolean(location)
    if (!redirecting || !location) return response

    await response.body?.cancel()
    current = new URL(location, current)
  }

  throw new Error(`Too many redirects for ${url}`)
}

export async function extractMetadata(
  response: Response,
  fallbackBase: string,
): Promise<Metadata> {
  const contentType = response.headers.get('content-type') ?? ''
  if (!response.ok || !contentType.includes('html')) {
    await response.body?.cancel()
    return {}
  }

  const base = response.url || fallbackBase
  const meta: Record<string, string> = {}
  let title = ''
  let favicon = ''

  await new HTMLRewriter()
    .on('title', {
      text(chunk) {
        title += chunk.text
      },
    })
    .on('meta', {
      element(element) {
        const key = (
          element.getAttribute('property') ?? element.getAttribute('name')
        )?.toLowerCase()
        const content = element.getAttribute('content')
        if (!key || !content || meta[key] !== undefined) return
        meta[key] = content
      },
    })
    .on('link', {
      element(element) {
        const rel = (element.getAttribute('rel') ?? '').toLowerCase()
        const href = element.getAttribute('href')
        if (!href || favicon) return
        if (rel.includes('icon')) favicon = href
      },
    })
    .transform(response)
    .text()

  return {
    title: clean(meta['og:title']) ?? clean(title),
    description: clean(meta['og:description']) ?? clean(meta.description),
    siteName: clean(meta['og:site_name']),
    faviconUrl: absolute(favicon, base),
    ogImageUrl: absolute(meta['og:image'], base),
  }
}

export async function fetchMetadata(url: string): Promise<Metadata> {
  const response = await fetchHtml(url)
  return extractMetadata(response, url)
}
