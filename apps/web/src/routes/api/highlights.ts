import { createFileRoute } from '@tanstack/react-router'
import { handleCreateHighlight } from '~/lib/api-handlers.server'

export const Route = createFileRoute('/api/highlights')({
  server: {
    handlers: {
      POST: ({ request }) => handleCreateHighlight(request),
    },
  },
})
