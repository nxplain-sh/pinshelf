import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { SignOut } from '~/components/SignOut'
import {
  queryKeys,
  useCreateCollection,
  useDeleteCollection,
  useRemoveSavedSearch,
  useRenameCollection,
  useSavedSearches,
  useSaveSearch,
  useSuggestSmartCollections,
} from '~/lib/queries'
import type { BookmarkFilters } from '~/lib/bookmarks.types'
import { fetchSession } from '~/lib/session'
import { listCollections } from '~/lib/taxonomy'

export const Route = createFileRoute('/collections')({
  beforeLoad: async () => {
    const session = await fetchSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    return { session }
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: queryKeys.collections,
      queryFn: () => listCollections(),
    })
  },
  component: CollectionsPage,
})

function CollectionsPage() {
  const { data: collections } = useSuspenseQuery({
    queryKey: queryKeys.collections,
    queryFn: () => listCollections(),
  })
  const createCollection = useCreateCollection()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  function create(event: FormEvent) {
    event.preventDefault()
    setError(null)
    createCollection.mutate(name, {
      onSuccess: (result) => {
        if (result.error) {
          setError(result.error)
          return
        }
        setName('')
      },
      onError: (cause) =>
        setError(cause instanceof Error ? cause.message : 'Failed to create collection'),
    })
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 p-6">
      <header className="flex items-center justify-between border-b border-line pb-4">
        <Link
          to="/"
          className="font-mono text-xs text-ink-muted transition-colors hover:text-ink"
        >
          ← pinshelf
        </Link>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-ink-faint">collections</span>
          <SignOut />
        </div>
      </header>

      <form onSubmit={create} className="flex gap-2">
        <input
          type="text"
          required
          placeholder="new collection name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="field flex-1"
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={createCollection.isPending}
        >
          Create
        </button>
      </form>
      {error && <p className="font-mono text-xs text-danger">{error}</p>}

      {collections.length === 0 ? (
        <p className="border border-dashed border-line py-10 text-center font-mono text-xs text-ink-faint">
          no collections yet
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {collections.map((collection) => (
            <CollectionRow
              key={collection.id}
              id={collection.id}
              name={collection.name}
              bookmarkCount={collection.bookmarkCount}
            />
          ))}
        </ul>
      )}

      <SmartCollections />
    </main>
  )
}

type Suggestion = {
  checked: boolean
  name: string
  reason: string
  query: BookmarkFilters
}

function describe(query: Suggestion['query']): string {
  return [
    query.tag ? `tag: ${query.tag}` : null,
    query.collection ? `collection: ${query.collection}` : null,
    query.q ? `“${query.q}”` : null,
    query.sort ? `sort: ${query.sort}` : null,
    query.status === 'active' ? null : query.status,
  ]
    .filter(Boolean)
    .join(' · ')
}

function SmartCollections() {
  const { data: savedSearches = [] } = useSavedSearches()
  const removeSavedSearch = useRemoveSavedSearch()
  const saveSearch = useSaveSearch()
  const suggest = useSuggestSmartCollections()
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [message, setMessage] = useState<string | null>(null)

  async function saveSelected() {
    const chosen = suggestions.filter((entry) => entry.checked)
    if (chosen.length === 0) return
    setMessage(null)
    // One round trip each, but in parallel: a suggestion list is short.
    await Promise.all(
      chosen.map((entry) =>
        saveSearch.mutateAsync({ name: entry.name, query: entry.query }),
      ),
    )
    setSuggestions([])
    setMessage(
      `saved ${chosen.length} smart ${chosen.length === 1 ? 'filter' : 'filters'}`,
    )
  }

  return (
    <section className="flex flex-col gap-3 border-t border-line pt-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium">Smart collections</h2>
        <p className="font-mono text-[11px] text-ink-faint">
          saved filters that keep matching new saves · collections stay manual folders
        </p>
      </div>

      <ul className="flex flex-col gap-1.5">
        {savedSearches.map((saved) => (
          <li
            key={saved.id}
            className="panel flex items-center justify-between gap-3 p-3"
          >
            <div className="flex min-w-0 flex-col">
              {saved.query.status === 'active' ? (
                <Link
                  to="/"
                  search={{
                    q: saved.query.q,
                    tag: saved.query.tag,
                    collection: saved.query.collection,
                    sort: saved.query.sort,
                  }}
                  className="truncate text-sm text-ink underline-offset-4 hover:underline"
                >
                  {saved.name}
                </Link>
              ) : (
                <Link
                  to="/archive"
                  search={{ status: saved.query.status }}
                  className="truncate text-sm text-ink underline-offset-4 hover:underline"
                >
                  {saved.name}
                </Link>
              )}
              <span className="font-mono text-[11px] text-ink-faint">
                {describe(saved.query) || 'everything'}
              </span>
            </div>
            <button
              type="button"
              className="btn shrink-0"
              onClick={() => removeSavedSearch.mutate(saved.id)}
            >
              delete
            </button>
          </li>
        ))}
        {savedSearches.length === 0 && (
          <li className="font-mono text-[11px] text-ink-faint">
            nothing saved yet — ask the model for ideas, or save a filter from the list
          </li>
        )}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn"
          disabled={suggest.isPending}
          onClick={() => {
            setMessage(null)
            suggest.mutate(4, {
              onSuccess: (items) =>
                setSuggestions(
                  items.map((item) => ({
                    checked: true,
                    name: item.name,
                    reason: item.reason,
                    query: {
                      status: item.status,
                      q: item.q,
                      tag: item.tag,
                      collection: item.collection,
                      sort: item.sort,
                    },
                  })),
                ),
            })
          }}
        >
          {suggest.isPending ? 'asking the model…' : 'suggest smart collections'}
        </button>
        {suggestions.length > 0 && (
          <button
            type="button"
            className="btn-primary"
            disabled={saveSearch.isPending}
            onClick={() => void saveSelected()}
          >
            {saveSearch.isPending ? 'saving…' : 'save selected'}
          </button>
        )}
      </div>

      {suggest.isError && (
        <p className="font-mono text-xs text-danger">
          {suggest.error instanceof Error
            ? suggest.error.message
            : 'could not get suggestions'}
        </p>
      )}
      {message && (
        <p role="status" className="font-mono text-xs text-ink-muted">
          {message}
        </p>
      )}

      {suggestions.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {suggestions.map((entry, index) => (
            <li key={entry.name} className="panel flex items-start gap-3 p-3">
              <input
                type="checkbox"
                checked={entry.checked}
                onChange={(event) =>
                  setSuggestions((current) =>
                    current.map((item, position) =>
                      position === index
                        ? { ...item, checked: event.target.checked }
                        : item,
                    ),
                  )
                }
                aria-label={`Save ${entry.name}`}
                className="checkbox mt-1 h-3.5 w-3.5 shrink-0"
              />
              <div className="flex min-w-0 flex-col">
                <span className="text-sm text-ink">{entry.name}</span>
                <span className="font-mono text-[11px] text-ink-faint">
                  {describe(entry.query) || 'everything'}
                </span>
                <span className="mt-1 font-mono text-[11px] text-ink-muted">
                  {entry.reason}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function CollectionRow({
  id,
  name,
  bookmarkCount,
}: {
  id: string
  name: string
  bookmarkCount: number
}) {
  const renameCollection = useRenameCollection()
  const deleteCollection = useDeleteCollection()
  const [value, setValue] = useState(name)
  const [error, setError] = useState<string | null>(null)

  function rename(event: FormEvent) {
    event.preventDefault()
    setError(null)
    renameCollection.mutate(
      { id, name: value },
      {
        onSuccess: (result) => {
          if (result.error) setError(result.error)
        },
        onError: (cause) =>
          setError(cause instanceof Error ? cause.message : 'Failed to rename'),
      },
    )
  }

  function remove() {
    if (!confirm(`Delete "${name}"? Its bookmarks stay, without a collection.`)) return
    deleteCollection.mutate(id)
  }

  return (
    <li className="panel flex flex-col gap-1 p-3">
      <form onSubmit={rename} className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="field flex-1 px-2 py-1 text-sm"
        />
        <span className="shrink-0 font-mono text-[11px] text-ink-faint">
          {bookmarkCount} bookmarks
        </span>
        <button type="submit" className="btn" disabled={renameCollection.isPending}>
          rename
        </button>
        <button type="button" onClick={remove} className="btn">
          delete
        </button>
      </form>
      {error && <p className="font-mono text-xs text-danger">{error}</p>}
    </li>
  )
}
