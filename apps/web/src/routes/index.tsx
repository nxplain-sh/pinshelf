import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { AddBookmarkForm } from '~/components/AddBookmarkForm'
import { AppHeader, PageHeading } from '~/components/AppHeader'
import { BookmarkList } from '~/components/BookmarkList'
import { BulkActions } from '~/components/BulkActions'
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
import { tagTone } from '~/lib/tag-tone'
import { listCollections, listTags } from '~/lib/taxonomy'

type BookmarkSearch = {
  q?: string
  tag?: string
  collection?: string
  host?: string
  sort?: BookmarkSort
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
    status: 'active',
    q: search.q,
    tag: search.tag,
    collection: search.collection,
    host: search.host,
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
    host: typeof search.host === 'string' && search.host ? search.host : undefined,
    sort: isBookmarkSort(search.sort) ? search.sort : undefined,
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
    host: search.host,
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
  const [query, setQuery] = useState(search.q ?? '')
  const [hostQuery, setHostQuery] = useState(search.host ?? '')
  const [showAllTags, setShowAllTags] = useState(false)
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

  const hasFilters = Boolean(search.q || search.tag || search.collection || search.host)
  const visibleTags = showAllTags
    ? tags
    : tags.filter((tag, index) => index < 8 || tag.name === search.tag)

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
      if (event.key === 'a') {
        event.preventDefault()
        archiveBookmark.mutate(active.id)
        setActiveIndex(-1)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bookmarks, activeIndex, navigate, trashBookmark, archiveBookmark])

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    void navigate({
      to: '/',
      search: {
        q: query.trim() || undefined,
        tag: search.tag,
        collection: search.collection,
        host: search.host,
        sort: search.sort,
      },
    })
  }

  return (
    <main className="page">
      <AppHeader />
      <PageHeading title="shelf" note={`signed in as ${session.user.email}`}>
        <span className="sticker">
          {bookmarks.length} {bookmarks.length === 1 ? 'bookmark' : 'bookmarks'}
        </span>
      </PageHeading>

      {staleAt && (
        <p className="notice bg-accent">
          offline — showing the list cached {new Date(staleAt).toLocaleString()}. Saves
          and edits will not stick until the connection is back.
        </p>
      )}

      <section className="panel flex flex-col gap-3 bg-accent p-4 shadow-hard-lg sm:p-5">
        <span className="label text-ink">pin a link</span>
        <AddBookmarkForm onAccent />
      </section>

      <div className="panel flex flex-col">
        <div className="flex flex-col gap-3 p-3 sm:p-4">
          <form onSubmit={submitSearch} className="flex gap-2">
            <input
              type="search"
              placeholder="search title, notes, url, tags…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="field min-w-0 flex-1 font-mono"
            />
            <button type="submit" className="btn" aria-label="Search">
              search
            </button>
            <button
              type="button"
              className="btn bg-lilac"
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
                    const target = {
                      q: filter.q,
                      tag: filter.tag,
                      collection: filter.collection,
                      sort: filter.sort,
                    }
                    if (filter.status && filter.status !== 'active') {
                      void navigate({ to: '/archive', search: { status: filter.status } })
                    } else {
                      void navigate({ to: '/', search: target })
                    }
                  },
                  onError: (cause) =>
                    setSmartNote({
                      tone: 'error',
                      text:
                        cause instanceof Error
                          ? cause.message
                          : 'could not interpret that',
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
              className={`notice self-start ${
                smartNote.tone === 'error' ? 'bg-coral' : 'bg-lilac'
              }`}
            >
              {smartNote.tone === 'error'
                ? smartNote.text
                : `interpreted: ${smartNote.text}`}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <input
              value={hostQuery}
              onChange={(event) => setHostQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                void navigate({
                  to: '/',
                  search: {
                    q: search.q,
                    tag: search.tag,
                    collection: search.collection,
                    sort: search.sort,
                    host: hostQuery.trim().toLowerCase() || undefined,
                  },
                })
              }}
              placeholder="host, e.g. doc.rust-lang.org"
              aria-label="Filter by host"
              className="field col-span-2 min-w-0 px-2.5 py-1.5 font-mono text-xs sm:col-span-1"
            />
            <select
              value={search.collection ?? ''}
              onChange={(event) =>
                void navigate({
                  to: '/',
                  search: {
                    q: search.q,
                    tag: search.tag,
                    sort: search.sort,
                    host: search.host,
                    collection: event.target.value || undefined,
                  },
                })
              }
              className="field min-w-0 px-2 py-1.5 font-mono text-xs"
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
                    host: search.host,
                    sort: event.target.value as BookmarkSort,
                  },
                })
              }
              className="field min-w-0 px-2 py-1.5 font-mono text-xs"
              aria-label="Sort bookmarks"
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t-2 border-line-soft px-3 py-3 sm:px-4">
          <span className="label mr-1">tags</span>
          {visibleTags.map((tag) => {
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
                      host: search.host,
                      tag: active ? undefined : tag.name,
                    },
                  })
                }
                className={
                  active ? 'chip bg-ink text-surface' : `chip ${tagTone(tag.name)}`
                }
              >
                {tag.name}
              </button>
            )
          })}

          {!showAllTags && tags.length > visibleTags.length && (
            <button type="button" onClick={() => setShowAllTags(true)} className="chip">
              +{tags.length - visibleTags.length} more
            </button>
          )}

          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                void navigate({ to: '/', search: {} })
              }}
              className="link ml-auto font-mono text-[11px]"
            >
              clear filters
            </button>
          )}
        </div>

        {(savedSearches.length > 0 || hasFilters) && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-b-[calc(var(--radius-lg)-2px)] border-t-2 border-line-soft bg-surface-hover px-3 py-3 sm:px-4">
            <span className="label mr-1">saved</span>
            {savedSearches.map((saved) => (
              // One pill, two targets: the name opens the search, × deletes it.
              <span
                key={saved.id}
                className="inline-flex items-stretch rounded-full border-2 border-line bg-pink font-mono text-[11px] leading-4 font-semibold text-ink"
              >
                <Link
                  to="/"
                  search={{
                    q: saved.query.q,
                    tag: saved.query.tag,
                    collection: saved.query.collection,
                    host: saved.query.host,
                    sort: saved.query.sort,
                  }}
                  className="rounded-l-full py-px pr-1.5 pl-2 hover:underline"
                >
                  {saved.name}
                </Link>
                <button
                  type="button"
                  aria-label={`Delete saved search ${saved.name}`}
                  className="rounded-r-full border-l-2 border-line px-1.5 transition-colors hover:bg-coral"
                  onClick={() => removeSavedSearch.mutate(saved.id)}
                >
                  ×
                </button>
              </span>
            ))}
            {hasFilters && (
              <form
                className="flex items-center gap-1.5 sm:ml-auto"
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
                  className="field w-40 px-2 py-1 font-mono text-xs"
                />
                <button type="submit" className="btn" disabled={!searchName.trim()}>
                  save
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {selected.size > 0 && (
        <BulkActions
          ids={[...selected]}
          urls={bookmarks
            .filter((bookmark) => selected.has(bookmark.id))
            .map((bookmark) => bookmark.url)}
          collections={collections}
          onClear={() => setSelected(new Set())}
        />
      )}

      {manual && (
        <p className="-mb-2 font-mono text-[11px] text-ink-faint">
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
