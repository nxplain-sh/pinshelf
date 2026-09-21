import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { BookmarkList } from '~/components/BookmarkList'
import { SignOut } from '~/components/SignOut'
import { listBookmarks } from '~/lib/bookmarks'
import { queryKeys } from '~/lib/queries'
import { fetchSession } from '~/lib/session'

type ArchiveSearch = {
  status?: 'archived' | 'trashed'
}

export const Route = createFileRoute('/archive/')({
  validateSearch: (search: Record<string, unknown>): ArchiveSearch => ({
    status:
      search.status === 'trashed' || search.status === 'archived'
        ? search.status
        : undefined,
  }),
  beforeLoad: async () => {
    const session = await fetchSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    return { session }
  },
  loaderDeps: ({ search }) => ({ status: search.status }),
  loader: async ({ context, deps }) => {
    const view = deps.status === 'trashed' ? 'trashed' : 'archived'
    await context.queryClient.ensureQueryData({
      queryKey: queryKeys.bookmarks.list({ status: view }),
      queryFn: () => listBookmarks({ data: { status: view } }),
    })
  },
  component: ArchivePage,
})

function ArchivePage() {
  const { status } = Route.useSearch()
  const view = status === 'trashed' ? 'trashed' : 'archived'
  const { data: bookmarks } = useSuspenseQuery({
    queryKey: queryKeys.bookmarks.list({ status: view }),
    queryFn: () => listBookmarks({ data: { status: view } }),
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
        <div className="flex items-center gap-4 font-mono text-xs text-ink-muted">
          <Link
            to="/archive"
            search={{}}
            className={view === 'archived' ? 'text-ink' : 'hover:text-ink'}
          >
            archived
          </Link>
          <Link
            to="/archive"
            search={{ status: 'trashed' }}
            className={view === 'trashed' ? 'text-ink' : 'hover:text-ink'}
          >
            trash
          </Link>
          <SignOut />
        </div>
      </header>

      <p className="font-mono text-[11px] text-ink-faint">
        {view === 'archived'
          ? 'taken off the shelf, nothing lost — restore puts one back'
          : 'restore puts a bookmark back · delete removes it for good'}
      </p>

      <BookmarkList bookmarks={bookmarks} />
    </main>
  )
}
