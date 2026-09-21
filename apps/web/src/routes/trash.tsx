import { createFileRoute, redirect } from '@tanstack/react-router'

// Trash is a view on /archive; keep the old URL working.
export const Route = createFileRoute('/trash')({
  beforeLoad: () => {
    throw redirect({ to: '/archive', search: { status: 'trashed' } })
  },
})
