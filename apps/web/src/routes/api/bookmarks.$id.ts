import { createFileRoute } from '@tanstack/react-router'
import {
  handleDeleteBookmark,
  handleGetBookmark,
  handleUpdateBookmark,
} from '~/lib/api-handlers.server'

export const Route = createFileRoute('/api/bookmarks/$id')({
  server: {
    handlers: {
      GET: ({ request, params }) => handleGetBookmark(request, params.id),
      PATCH: ({ request, params }) => handleUpdateBookmark(request, params.id),
      DELETE: ({ request, params }) => handleDeleteBookmark(request, params.id),
    },
  },
})
