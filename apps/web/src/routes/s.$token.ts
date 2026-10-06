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
      /* Mirrors the app tokens in styles/app.css: this page is plain HTML. */
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0; min-height: 100vh; padding: 3rem 1rem;
        background-color: #f4eee1; color: #131110;
        background-image: radial-gradient(rgba(19, 17, 16, 0.13) 1px, transparent 1.4px);
        background-size: 22px 22px;
        font-family: 'Space Grotesk', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.6;
      }
      main {
        margin: 0 auto; max-width: 40rem; padding: 1.5rem;
        background: #fffcf5; border: 2px solid #131110; border-radius: 14px;
        box-shadow: 8px 8px 0 0 #131110;
      }
      h1 { margin: 0 0 0.5rem; font-size: 1.75rem; line-height: 1.15; letter-spacing: -0.02em;
        overflow-wrap: anywhere; }
      p { margin: 0.75rem 0 0; }
      a { color: #131110; font-weight: 600; text-decoration: underline;
        text-decoration-color: #fcc93a; text-decoration-thickness: 2px; text-underline-offset: 4px; }
      .meta { margin: 0; font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 12px; color: #463e36; overflow-wrap: anywhere; }
      .tags { margin-top: 1.25rem; display: flex; flex-wrap: wrap; gap: 6px; }
      .tag { border: 2px solid #131110; border-radius: 999px; padding: 0 8px; background: #fffcf5;
        font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace; font-size: 11px; font-weight: 600;
        line-height: 18px; color: #131110; }
      .tag:nth-child(5n + 1) { background: #fcc93a; }
      .tag:nth-child(5n + 2) { background: #ffa3c8; }
      .tag:nth-child(5n + 3) { background: #92d2ff; }
      .tag:nth-child(5n + 4) { background: #9be8b4; }
      .tag:nth-child(5n + 5) { background: #c8b6ff; }
      .notes { margin-top: 1.5rem; border: 2px solid #131110; border-radius: 10px;
        background: #ece4d4; padding: 1rem; white-space: pre-wrap; color: #463e36; }
      .foot { margin-top: 1.5rem; padding-top: 1rem; border-top: 2px solid #d8cebb; color: #6b6155; }
      @media (min-width: 640px) { main { padding: 2rem; } h1 { font-size: 2.25rem; } }
    </style>
  </head>
  <body><main>${body}</main></body>
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
  <p class="meta foot">shared from pinshelf</p>`,
        )
      },
    },
  },
})
