import { createFileRoute } from '@tanstack/react-router'
import { handleCreateBookmark, handleListBookmarks } from '~/lib/api-handlers.server'

export const Route = createFileRoute('/api/bookmarks')({
  server: {
    handlers: {
      GET: ({ request }) => handleListBookmarks(request),
      POST: ({ request }) => handleCreateBookmark(request),
    },
  },
})
