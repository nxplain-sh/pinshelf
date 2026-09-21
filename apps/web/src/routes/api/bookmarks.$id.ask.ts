import { createFileRoute } from '@tanstack/react-router'
import { handleAskBookmark } from '~/lib/api-handlers.server'

export const Route = createFileRoute('/api/bookmarks/$id/ask')({
  server: {
    handlers: {
      POST: ({ request, params }) => handleAskBookmark(request, params.id),
    },
  },
})
