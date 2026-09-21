import { readArchive } from '~/lib/archive.server'
import { getBookmarkById } from '~/lib/bookmarks.server'
import { fetchHtml } from '~/lib/metadata.server'
import { fetchYoutubeTranscript, youtubeVideoId } from '~/lib/page-text.server'

const MAX_HTML_BYTES = 2 * 1024 * 1024

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Makes foreign HTML safe to hand to a sandboxed iframe: scripts go, and a
 * `<base>` points relative urls back at the original site (otherwise they would
 * resolve against the app). The iframe itself is `sandbox=""`, so even inline
 * handlers and javascript: urls are inert.
 */
export function prepareHtml(html: string, url: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/ on[a-z]+=("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .slice(0, MAX_HTML_BYTES)

  if (/<base[\s>]/i.test(withoutScripts)) return withoutScripts

  // Foreign pages assume a browser canvas, not our dark surface.
  const tag = `<base href="${escapeHtml(url)}"><style>html{background:#fff;color-scheme:light}</style>`
  if (/<head[^>]*>/i.test(withoutScripts)) {
    return withoutScripts.replace(/<head[^>]*>/i, (match) => `${match}${tag}`)
  }
  return `${tag}${withoutScripts}`
}

export type ReaderResult = {
  title: string | null
  url: string
  html: string
  source: 'youtube' | 'snapshot' | 'live'
}

/** Best available render of one bookmark: transcript, snapshot, then live fetch. */
export async function readBookmarkPage(id: string): Promise<ReaderResult> {
  const bookmark = await getBookmarkById(id)
  if (!bookmark) throw new Error('Bookmark not found')

  const base = { title: bookmark.title, url: bookmark.url }

  const videoId = youtubeVideoId(bookmark.url)
  if (videoId) {
    const transcript = await fetchYoutubeTranscript(videoId)
    if (transcript) {
      return {
        ...base,
        html: `<pre style="white-space:pre-wrap;font:14px/1.6 ui-monospace,monospace;padding:16px;margin:0">${escapeHtml(transcript)}</pre>`,
        source: 'youtube',
      }
    }
  }

  if (bookmark.archiveKey) {
    const object = await readArchive(bookmark.archiveKey)
    if (object) {
      return {
        ...base,
        html: prepareHtml(await object.text(), bookmark.url),
        source: 'snapshot',
      }
    }
  }

  const response = await fetchHtml(bookmark.url)
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error('The page did not answer')
  }
  return {
    ...base,
    html: prepareHtml((await response.text()).slice(0, MAX_HTML_BYTES), bookmark.url),
    source: 'live',
  }
}
