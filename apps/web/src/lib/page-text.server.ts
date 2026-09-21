import { readArchive } from '~/lib/archive.server'

/** Prompt budget: enough for a long article, small enough for a small model. */
const MAX_SOURCE_CHARS = 24_000

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
}

/** Crude but dependency-free: drops script/style/tags and collapses to text. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function youtubeVideoId(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const host = parsed.hostname.replace(/^(www|m)\./, '')
  if (host === 'youtu.be') return parsed.pathname.slice(1).split('/')[0] || null
  if (host !== 'youtube.com') return null
  if (parsed.pathname === '/watch') return parsed.searchParams.get('v')
  const match = parsed.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)
  return match ? match[1] : null
}

/**
 * Reads the caption track off the watch page. YouTube has no keyless API for
 * this, so it is a scrape: when it breaks, bookmark AI falls back to the
 * archive snapshot and metadata.
 */
export async function fetchYoutubeTranscript(videoId: string): Promise<string | null> {
  try {
    const page = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'accept-language': 'en' },
      signal: AbortSignal.timeout(20_000),
    })
    if (!page.ok) return null

    const html = await page.text()
    const tracks = html.match(/"captionTracks":(\[.*?\])/)
    if (!tracks) return null

    const parsed = JSON.parse(tracks[1]) as {
      baseUrl?: string
      languageCode?: string
    }[]
    const track =
      parsed.find((entry) => entry.languageCode?.startsWith('en')) ?? parsed[0]
    if (!track?.baseUrl) return null

    const captions = await fetch(`${track.baseUrl}&fmt=json3`, {
      signal: AbortSignal.timeout(20_000),
    })
    if (!captions.ok) return null

    const body = (await captions.json()) as {
      events?: { segs?: { utf8?: string }[] }[]
    }
    const text = (body.events ?? [])
      .flatMap((event) => event.segs ?? [])
      .map((segment) => segment.utf8 ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()

    return text ? text.slice(0, MAX_SOURCE_CHARS) : null
  } catch {
    return null
  }
}

export type PageTextSource = 'youtube' | 'archive' | 'metadata'
export type PageText = { text: string; source: PageTextSource }

export async function pageTextFor(bookmark: {
  url: string
  title: string | null
  description: string | null
  archiveKey: string | null
}): Promise<PageText> {
  const videoId = youtubeVideoId(bookmark.url)
  if (videoId) {
    const transcript = await fetchYoutubeTranscript(videoId)
    if (transcript) return { text: transcript, source: 'youtube' }
  }

  if (bookmark.archiveKey) {
    const object = await readArchive(bookmark.archiveKey)
    if (object) {
      const text = htmlToText(await object.text()).slice(0, MAX_SOURCE_CHARS)
      if (text) return { text, source: 'archive' }
    }
  }

  const metadata = [bookmark.title, bookmark.description, bookmark.url]
    .filter(Boolean)
    .join('\n')
  return { text: metadata.slice(0, MAX_SOURCE_CHARS), source: 'metadata' }
}
