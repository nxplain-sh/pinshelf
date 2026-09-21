import { createFileRoute } from '@tanstack/react-router'
import { readArchive } from '~/lib/archive.server'
import { auth } from '~/lib/auth.server'
import { getBookmarkById } from '~/lib/bookmarks.server'

// Session-guarded snapshot viewer. The archived HTML is untrusted, so it is
// served with a sandbox CSP: no scripts, no same-origin access, no forms.
export const Route = createFileRoute('/archive/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) return new Response('not found', { status: 404 })

        const bookmark = await getBookmarkById(params.id)
        if (!bookmark?.archiveKey) return new Response('not found', { status: 404 })

        const object = await readArchive(bookmark.archiveKey)
        if (!object) return new Response('not found', { status: 404 })

        return new Response(object.body, {
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'content-security-policy': 'sandbox; default-src none',
            'x-content-type-options': 'nosniff',
            'cache-control': 'private, max-age=0, must-revalidate',
          },
        })
      },
    },
  },
})
