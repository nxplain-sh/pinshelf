import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { AppHeader, PageHeading } from '~/components/AppHeader'
import { BookmarkList } from '~/components/BookmarkList'
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

// Both tabs share the /archive path, and the router matches search params
// partially, so it would mark "archived" active on the trash view as well.
// The active segment comes from `view` instead of data-status.
const SEGMENT =
  'rounded-md border-2 px-3 py-1 font-mono text-xs font-bold transition-colors'
const SEGMENT_ACTIVE = `${SEGMENT} border-line bg-accent text-ink shadow-hard-xs`
const SEGMENT_IDLE = `${SEGMENT} border-transparent text-ink-muted hover:border-line hover:bg-surface-hover hover:text-ink`

function ArchivePage() {
  const { status } = Route.useSearch()
  const view = status === 'trashed' ? 'trashed' : 'archived'
  const { data: bookmarks } = useSuspenseQuery({
    queryKey: queryKeys.bookmarks.list({ status: view }),
    queryFn: () => listBookmarks({ data: { status: view } }),
  })

  return (
    <main className="page">
      <AppHeader />
      <PageHeading
        title="archive"
        note={
          view === 'archived'
            ? 'taken off the shelf, nothing lost — restore puts one back'
            : 'restore puts a bookmark back · delete removes it for good'
        }
      >
        <div className="flex items-center gap-1 rounded-lg border-2 border-line bg-surface p-1 shadow-hard-xs">
          <Link
            to="/archive"
            search={{}}
            className={view === 'archived' ? SEGMENT_ACTIVE : SEGMENT_IDLE}
          >
            archived
          </Link>
          <Link
            to="/archive"
            search={{ status: 'trashed' }}
            className={view === 'trashed' ? SEGMENT_ACTIVE : SEGMENT_IDLE}
          >
            trash
          </Link>
        </div>
      </PageHeading>

      <BookmarkList bookmarks={bookmarks} />
    </main>
  )
}
