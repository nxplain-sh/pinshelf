import { createFileRoute } from '@tanstack/react-router'
import { handleHealth } from '~/lib/api-handlers.server'

export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: () => handleHealth(),
    },
  },
})
