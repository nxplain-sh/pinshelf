import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { AddBookmarkForm } from '~/components/AddBookmarkForm'
import { BookmarkList } from '~/components/BookmarkList'
import { BulkActions } from '~/components/BulkActions'
import { Logo } from '~/components/Logo'
import { authClient } from '~/lib/auth'
import { listBookmarks } from '~/lib/bookmarks'
import { isBookmarkSort } from '~/lib/bookmarks.types'
import type { BookmarkFilters, BookmarkSort } from '~/lib/bookmarks.types'
import {
  queryKeys,
  useArchiveBookmark,
  useRemoveSavedSearch,
  useReorderBookmarks,
  useSavedSearches,
  useSaveSearch,
  useSmartSearch,
  useTrashBookmark,
} from '~/lib/queries'
import { fetchSession } from '~/lib/session'
import { listCacheKey, readCachedList, writeCachedList } from '~/lib/offline'
import { listCollections, listTags } from '~/lib/taxonomy'

type BookmarkSearch = {
  q?: string
  tag?: string
  collection?: string
  sort?: BookmarkSort
  status?: 'active' | 'archived'
}

const SORTS: { value: BookmarkSort; label: string }[] = [
  { value: 'newest', label: 'newest first' },
  { value: 'oldest', label: 'oldest first' },
  { value: 'title-asc', label: 'title a–z' },
  { value: 'title-desc', label: 'title z–a' },
  { value: 'manual', label: 'manual order (drag)' },
]

function filtersFor(search: BookmarkSearch): BookmarkFilters {
  return {
    status: search.status === 'archived' ? 'archived' : 'active',
    q: search.q,
    tag: search.tag,
    collection: search.collection,
    sort: search.sort,
  }
}

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): BookmarkSearch => ({
    q: typeof search.q === 'string' && search.q ? search.q : undefined,
    tag: typeof search.tag === 'string' && search.tag ? search.tag : undefined,
    collection:
      typeof search.collection === 'string' && search.collection
        ? search.collection
        : undefined,
    sort: isBookmarkSort(search.sort) ? search.sort : undefined,
    status: search.status === 'archived' ? 'archived' : undefined,
  }),
  beforeLoad: async () => {
    const session = await fetchSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    return { session }
  },
  loaderDeps: ({ search }) => ({
    q: search.q,
    tag: search.tag,
    collection: search.collection,
    sort: search.sort,
  }),
  loader: async ({ context, deps }) => {
    const filters = filtersFor(deps)
    const listKey = queryKeys.bookmarks.list(filters)

    // A failed list fetch falls back to the last cached copy instead of an
    // error page; the component shows how old that copy is.
    try {
      await Promise.all([
        context.queryClient.ensureQueryData({
          queryKey: listKey,
          queryFn: () => listBookmarks({ data: filters }),
        }),
        context.queryClient.ensureQueryData({
          queryKey: queryKeys.tags,
          queryFn: () => listTags(),
        }),
        context.queryClient.ensureQueryData({
          queryKey: queryKeys.collections,
          queryFn: () => listCollections(),
        }),
      ])
      return { staleAt: null as string | null }
    } catch (cause) {
      const cached = readCachedList(listCacheKey(filters))
      if (!cached) throw cause
      context.queryClient.setQueryData(listKey, cached.items)
      return { staleAt: cached.savedAt }
    }
  },
  component: Home,
})

function Home() {
  const { session } = Route.useRouteContext()
  const { staleAt } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const filters = filtersFor(search)
  const { data: bookmarks } = useSuspenseQuery({
    queryKey: queryKeys.bookmarks.list(filters),
    queryFn: () => listBookmarks({ data: filters }),
  })
  const { data: tags } = useSuspenseQuery({
    queryKey: queryKeys.tags,
    queryFn: () => listTags(),
  })
  const { data: collections } = useSuspenseQuery({
    queryKey: queryKeys.collections,
    queryFn: () => listCollections(),
  })

  const reorderBookmarks = useReorderBookmarks()
  const trashBookmark = useTrashBookmark()
  const archiveBookmark = useArchiveBookmark()
  const { data: savedSearches = [] } = useSavedSearches()
  const saveSearch = useSaveSearch()
  const removeSavedSearch = useRemoveSavedSearch()
  const smartSearch = useSmartSearch()
  const [smartNote, setSmartNote] = useState<{
    text: string
    tone: 'info' | 'error'
  } | null>(null)
  const [searchName, setSearchName] = useState('')
  const manual = search.sort === 'manual'
  const archivedView = search.status === 'archived'
  const [query, setQuery] = useState(search.q ?? '')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [activeIndex, setActiveIndex] = useState(-1)

  // Filtering hides rows; a stale selection would let bulk actions hit
  // bookmarks that are no longer on screen. Comparing signatures also covers
  // back/forward navigation between filtered views.
  const filterSignature = `${search.q ?? ''}|${search.tag ?? ''}|${search.collection ?? ''}`
  const lastSignature = useRef(filterSignature)

  // Keep the offline copy fresh whenever a list loads from the server.
  useEffect(() => {
    if (!staleAt) writeCachedList(listCacheKey(filtersFor(search)), bookmarks)
  }, [bookmarks, search, staleAt])

  useEffect(() => {
    if (lastSignature.current !== filterSignature) {
      lastSignature.current = filterSignature
      setSelected(new Set())
    }
  }, [filterSignature])

  const hasFilters = Boolean(search.q || search.tag || search.collection)

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll(ids: string[]) {
    setSelected((current) =>
      ids.every((id) => current.has(id)) ? new Set() : new Set(ids),
    )
  }

  // List shortcuts: j/k move the highlight, enter opens, x selects, t trashes.
  // They stay out of the way while a field has focus.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const element = event.target as HTMLElement | null
      if (
        element &&
        (element.tagName === 'INPUT' ||
          element.tagName === 'TEXTAREA' ||
          element.tagName === 'SELECT' ||
          element.isContentEditable)
      ) {
        return
      }
      if (bookmarks.length === 0) return

      if (event.key === 'j' || event.key === 'k') {
        event.preventDefault()
        setActiveIndex((current) => {
          const next =
            event.key === 'j'
              ? Math.min(current + 1, bookmarks.length - 1)
              : Math.max(current - 1, 0)
          const id = bookmarks[next]?.id
          if (id) {
            document
              .querySelector(`[data-bookmark-id="${id}"]`)
              ?.scrollIntoView({ block: 'nearest' })
          }
          return next
        })
        return
      }

      const active = bookmarks[activeIndex]
      if (!active) return

      if (event.key === 'Enter') {
        event.preventDefault()
        void navigate({ to: '/bookmarks/$id', params: { id: active.id } })
      }
      if (event.key === 'x') {
        event.preventDefault()
        setSelected((current) => {
          const next = new Set(current)
          if (next.has(active.id)) next.delete(active.id)
          else next.add(active.id)
          return next
        })
      }
      if (event.key === 't') {
        event.preventDefault()
        trashBookmark.mutate(active.id)
        setActiveIndex(-1)
      }
      if (event.key === 'a' && !archivedView) {
        event.preventDefault()
        archiveBookmark.mutate(active.id)
        setActiveIndex(-1)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bookmarks, activeIndex, navigate, trashBookmark, archiveBookmark, archivedView])

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    void navigate({
      to: '/',
      search: {
        q: query.trim() || undefined,
        tag: search.tag,
        collection: search.collection,
        sort: search.sort,
        status: search.status,
      },
    })
  }

  async function signOut() {
    await authClient.signOut()
    queryClient.clear()
    await navigate({ to: '/login' })
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 p-6">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line pb-4">
        <div className="flex items-baseline gap-3">
          <div className="flex items-center gap-2">
            <Logo />
            <h1 className="text-base font-semibold tracking-tight">pinshelf</h1>
          </div>
          <span className="font-mono text-[11px] text-ink-faint">
            {session.user.email}
          </span>
        </div>
        <nav className="flex items-center gap-4 font-mono text-xs text-ink-muted">
          {archivedView ? (
            <Link to="/" search={{}} className="transition-colors hover:text-ink">
              active
            </Link>
          ) : (
            <Link
              to="/"
              search={{ status: 'archived' }}
              className="transition-colors hover:text-ink"
            >
              archived
            </Link>
          )}
          <Link to="/collections" className="transition-colors hover:text-ink">
            collections
          </Link>
          <Link to="/trash" className="transition-colors hover:text-ink">
            trash
          </Link>
          <Link to="/cleanup" className="transition-colors hover:text-ink">
            cleanup
          </Link>
          <Link to="/insights" className="transition-colors hover:text-ink">
            insights
          </Link>
          <Link to="/settings" className="transition-colors hover:text-ink">
            settings
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="transition-colors hover:text-ink"
          >
            sign out
          </button>
        </nav>
      </header>

      {staleAt && (
        <p className="panel border-warn/40 p-3 font-mono text-[11px] text-warn">
          offline — showing the list cached {new Date(staleAt).toLocaleString()}. Saves
          and edits will not stick until the connection is back.
        </p>
      )}

      <AddBookmarkForm />

      <div className="flex flex-col gap-2.5">
        <form onSubmit={submitSearch} className="flex gap-2">
          <input
            type="search"
            placeholder="search title, notes, url, tags…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="field flex-1 font-mono"
          />
          <button type="submit" className="btn" aria-label="Search">
            search
          </button>
          <button
            type="button"
            className="btn"
            disabled={!query.trim() || smartSearch.isPending}
            title="Describe what you want in plain words and let the model turn it into filters"
            onClick={() => {
              setSmartNote(null)
              smartSearch.mutate(query, {
                onSuccess: (filter) => {
                  setSmartNote({
                    tone: 'info',
                    text:
                      filter.explanation ??
                      `q=${filter.q ?? '—'} tag=${filter.tag ?? '—'} collection=${filter.collection ?? '—'}`,
                  })
                  void navigate({
                    to: '/',
                    search: {
                      q: filter.q,
                      tag: filter.tag,
                      collection: filter.collection,
                      sort: filter.sort,
                      status: filter.status === 'archived' ? 'archived' : undefined,
                    },
                  })
                },
                onError: (cause) =>
                  setSmartNote({
                    tone: 'error',
                    text:
                      cause instanceof Error ? cause.message : 'could not interpret that',
                  }),
              })
            }}
          >
            {smartSearch.isPending ? 'thinking…' : 'smart'}
          </button>
        </form>
        {smartNote && (
          <p
            role="status"
            className={`font-mono text-[11px] ${
              smartNote.tone === 'error' ? 'text-danger' : 'text-ink-muted'
            }`}
          >
            {smartNote.tone === 'error'
              ? smartNote.text
              : `interpreted: ${smartNote.text}`}
          </p>
        )}

        {(savedSearches.length > 0 || hasFilters) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="label">saved</span>
            {savedSearches.map((saved) => (
              <span key={saved.id} className="flex items-center gap-1">
                <Link
                  to="/"
                  search={{
                    q: saved.query.q,
                    tag: saved.query.tag,
                    collection: saved.query.collection,
                    sort: saved.query.sort,
                    status: saved.query.status === 'archived' ? 'archived' : undefined,
                  }}
                  className="chip hover:border-line-strong hover:text-ink"
                >
                  {saved.name}
                </Link>
                <button
                  type="button"
                  aria-label={`Delete saved search ${saved.name}`}
                  className="font-mono text-[11px] text-ink-faint hover:text-danger"
                  onClick={() => removeSavedSearch.mutate(saved.id)}
                >
                  ×
                </button>
              </span>
            ))}
            {hasFilters && (
              <form
                className="flex items-center gap-1"
                onSubmit={(event) => {
                  event.preventDefault()
                  saveSearch.mutate(
                    { name: searchName, query: filtersFor(search) },
                    {
                      onSuccess: () => setSearchName(''),
                    },
                  )
                }}
              >
                <input
                  value={searchName}
                  onChange={(event) => setSearchName(event.target.value)}
                  placeholder="name this search"
                  aria-label="Saved search name"
                  className="field px-2 py-1 font-mono text-xs"
                />
                <button type="submit" className="btn" disabled={!searchName.trim()}>
                  save
                </button>
              </form>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={search.collection ?? ''}
            onChange={(event) =>
              void navigate({
                to: '/',
                search: {
                  q: search.q,
                  tag: search.tag,
                  sort: search.sort,
                  collection: event.target.value || undefined,
                },
              })
            }
            className="field px-2 py-1 font-mono text-xs"
            aria-label="Filter by collection"
          >
            <option value="">all bookmarks</option>
            <option value="unsorted">unsorted</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name} ({collection.bookmarkCount})
              </option>
            ))}
          </select>

          <select
            value={search.sort ?? 'newest'}
            onChange={(event) =>
              void navigate({
                to: '/',
                search: {
                  q: search.q,
                  tag: search.tag,
                  collection: search.collection,
                  sort: event.target.value as BookmarkSort,
                },
              })
            }
            className="field px-2 py-1 font-mono text-xs"
            aria-label="Sort bookmarks"
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {tags.map((tag) => {
            const active = search.tag === tag.name
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() =>
                  void navigate({
                    to: '/',
                    search: {
                      q: search.q,
                      collection: search.collection,
                      sort: search.sort,
                      tag: active ? undefined : tag.name,
                    },
                  })
                }
                className={
                  active
                    ? 'rounded border border-accent/50 bg-accent/10 px-1.5 py-0.5 font-mono text-[11px] text-accent'
                    : 'chip transition-colors hover:border-line-strong hover:text-ink'
                }
              >
                {tag.name}
              </button>
            )
          })}

          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                void navigate({ to: '/', search: {} })
              }}
              className="font-mono text-[11px] text-ink-faint underline underline-offset-4 hover:text-ink"
            >
              clear filters
            </button>
          )}
        </div>
      </div>

      {selected.size > 0 && (
        <BulkActions
          ids={[...selected]}
          collections={collections}
          onClear={() => setSelected(new Set())}
        />
      )}

      {manual && (
        <p className="font-mono text-[11px] text-ink-faint">
          drag rows by the handle to set your own order
          {search.q || search.tag || search.collection
            ? ' — ordering applies to the visible list'
            : ''}
        </p>
      )}

      <BookmarkList
        bookmarks={bookmarks}
        selectable
        selected={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
        manual={manual}
        onReorder={(ids) => reorderBookmarks.mutate(ids)}
        activeId={bookmarks[activeIndex]?.id ?? null}
      />
    </main>
  )
}
