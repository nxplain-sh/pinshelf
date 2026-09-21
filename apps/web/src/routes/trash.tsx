import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { BookmarkList } from '~/components/BookmarkList'
import { listBookmarks } from '~/lib/bookmarks'
import { queryKeys } from '~/lib/queries'
import { fetchSession } from '~/lib/session'

const filters = { status: 'trashed' as const }

export const Route = createFileRoute('/trash')({
  beforeLoad: async () => {
    const session = await fetchSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    return { session }
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: queryKeys.bookmarks.list(filters),
      queryFn: () => listBookmarks({ data: filters }),
    })
  },
  component: Trash,
})

function Trash() {
  const { data: bookmarks } = useSuspenseQuery({
    queryKey: queryKeys.bookmarks.list(filters),
    queryFn: () => listBookmarks({ data: filters }),
  })

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 p-6">
      <header className="flex items-center justify-between border-b border-line pb-4">
        <Link
          to="/"
          className="font-mono text-xs text-ink-muted transition-colors hover:text-ink"
        >
          ← pinshelf
        </Link>
        <span className="font-mono text-xs text-ink-faint">trash</span>
      </header>

      <BookmarkList bookmarks={bookmarks} />
    </main>
  )
}
