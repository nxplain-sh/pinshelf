import { createFileRoute } from '@tanstack/react-router'
import { handleListCollections } from '~/lib/api-handlers.server'

export const Route = createFileRoute('/api/collections')({
  server: {
    handlers: {
      GET: ({ request }) => handleListCollections(request),
    },
  },
})
