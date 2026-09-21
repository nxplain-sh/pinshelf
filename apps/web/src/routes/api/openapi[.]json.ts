import { createFileRoute } from '@tanstack/react-router'
import { buildOpenApiDocument } from '~/lib/openapi'

export const Route = createFileRoute('/api/openapi.json')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const origin = new URL(request.url).origin
        return Response.json(buildOpenApiDocument(origin))
      },
    },
  },
})
