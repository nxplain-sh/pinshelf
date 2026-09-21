const TRACKING_PREFIXES = ['utm_']

const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'igshid',
  'mc_eid',
  'msclkid',
  'yclid',
])

export function normalizeUrl(input: string): string {
  const url = new URL(input.trim())

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported URL protocol: ${url.protocol}`)
  }

  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '')
  if (
    (url.protocol === 'https:' && url.port === '443') ||
    (url.protocol === 'http:' && url.port === '80')
  ) {
    url.port = ''
  }

  url.hash = ''

  const params = [...url.searchParams]
    .filter(
      ([key]) =>
        !TRACKING_PARAMS.has(key) &&
        !TRACKING_PREFIXES.some((prefix) => key.startsWith(prefix)),
    )
    .sort(([a], [b]) => a.localeCompare(b))

  url.search = ''
  for (const [key, value] of params) {
    url.searchParams.append(key, value)
  }

  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, '')
  }

  return url.toString()
}

export async function urlHash(input: string): Promise<string> {
  const data = new TextEncoder().encode(normalizeUrl(input))
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
