import { createFileRoute } from '@tanstack/react-router'
import { handleListTags } from '~/lib/api-handlers.server'

export const Route = createFileRoute('/api/tags')({
  server: {
    handlers: {
      GET: ({ request }) => handleListTags(request),
    },
  },
})
