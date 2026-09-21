import { createFileRoute } from '@tanstack/react-router'
import { getBookmarkById } from '~/lib/bookmarks.server'
import { resolveShareToken } from '~/lib/share-links.server'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function page(title: string, body: string, status = 200): Response {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0 auto; max-width: 40rem; padding: 3rem 1.5rem;
        background: #131110; color: #f2ece2;
        font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.65;
      }
      a { color: #c9a227; }
      .meta { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 12px; color: #b3a99b; }
      .tags { margin-top: 1rem; display: flex; flex-wrap: wrap; gap: 6px; }
      .tag { border: 1px solid #2e2925; border-radius: 4px; padding: 2px 8px;
        font-family: ui-monospace, Menlo, monospace; font-size: 11px; color: #b3a99b; }
      .notes { margin-top: 1.5rem; border: 1px solid #2e2925; border-radius: 6px;
        padding: 1rem; white-space: pre-wrap; color: #b3a99b; }
    </style>
  </head>
  <body>${body}</body>
</html>`
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'private, max-age=0, must-revalidate',
    },
  })
}

// Public, read-only page for one bookmark. Anyone with the link can read it;
// nothing else in the library is reachable from here.
export const Route = createFileRoute('/s/$token')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const bookmarkId = await resolveShareToken(params.token)
        if (!bookmarkId)
          return page('link not available', '<p>This link is gone.</p>', 404)

        const bookmark = await getBookmarkById(bookmarkId)
        if (!bookmark) return page('link not available', '<p>This link is gone.</p>', 404)

        const title = bookmark.title ?? bookmark.url
        const tags = bookmark.tags
          .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
          .join('')

        return page(
          title,
          `<h1>${escapeHtml(title)}</h1>
  <p class="meta">${escapeHtml(bookmark.url)}</p>
  ${bookmark.description ? `<p>${escapeHtml(bookmark.description)}</p>` : ''}
  ${tags ? `<div class="tags">${tags}</div>` : ''}
  ${bookmark.notes ? `<div class="notes">${escapeHtml(bookmark.notes)}</div>` : ''}
  <p class="meta">shared from pinshelf</p>`,
        )
      },
    },
  },
})
