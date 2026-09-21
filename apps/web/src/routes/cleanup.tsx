import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { getAiSettings, scanCleanup } from '~/lib/ai'
import type { AiProposals } from '~/lib/ai-schemas'
import { listBookmarks } from '~/lib/bookmarks'
import { insights } from '~/lib/library'
import type { BookmarkFilters } from '~/lib/bookmarks.types'
import {
  queryKeys,
  useApplyCleanup,
  useFindDuplicates,
  useTrashBookmark,
} from '~/lib/queries'
import { fetchSession } from '~/lib/session'

const activeFilters: BookmarkFilters = { status: 'active' }

export const Route = createFileRoute('/cleanup')({
  beforeLoad: async () => {
    const session = await fetchSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    return { session }
  },
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData({
        queryKey: queryKeys.aiSettings,
        queryFn: () => getAiSettings(),
      }),
      context.queryClient.ensureQueryData({
        queryKey: queryKeys.bookmarks.list(activeFilters),
        queryFn: () => listBookmarks({ data: activeFilters }),
      }),
      context.queryClient.ensureQueryData({
        queryKey: queryKeys.insights,
        queryFn: () => insights(),
      }),
    ])
  },
  component: CleanupPage,
})

function CleanupPage() {
  const { data: aiSettings } = useSuspenseQuery({
    queryKey: queryKeys.aiSettings,
    queryFn: () => getAiSettings(),
  })
  const { data: bookmarks } = useSuspenseQuery({
    queryKey: queryKeys.bookmarks.list(activeFilters),
    queryFn: () => listBookmarks({ data: activeFilters }),
  })
  const { data: library } = useSuspenseQuery({
    queryKey: queryKeys.insights,
    queryFn: () => insights(),
  })

  const queryClient = useQueryClient()
  const applyCleanup = useApplyCleanup()
  const [limit, setLimit] = useState(50)
  const [result, setResult] = useState<{
    scanned: number
    batches: number
    promptTokens: number
    completionTokens: number
    unassigned: number
    tidy: boolean
    proposals: AiProposals
  } | null>(null)
  const [skippedDuplicates, setSkippedDuplicates] = useState<Set<number>>(new Set())
  const [skippedUpdates, setSkippedUpdates] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<string | null>(null)

  const scan = useMutation({
    mutationFn: (input: { limit: number; onlyUnsorted?: boolean }) =>
      scanCleanup({ data: input }),
    onSuccess: (data, variables) => {
      setResult({ ...data, tidy: variables.onlyUnsorted === true })
      setSkippedDuplicates(new Set())
      setSkippedUpdates(new Set())
      setMessage(null)
    },
    onError: (cause) =>
      setMessage(cause instanceof Error ? cause.message : 'scan failed'),
  })

  const titles = new Map(
    bookmarks.map((bookmark) => [bookmark.id, bookmark.title || bookmark.url]),
  )
  const label = (id: string) => titles.get(id) ?? id

  const duplicates = (result?.proposals.duplicates ?? []).filter(
    (_group, index) => !skippedDuplicates.has(index),
  )
  const updates = (result?.proposals.updates ?? []).filter(
    (update) => !skippedUpdates.has(update.id),
  )

  function apply() {
    setMessage(null)
    applyCleanup.mutate(
      { duplicates, updates },
      {
        onSuccess: async (summary) => {
          setResult(null)
          setMessage(
            `trashed ${summary.trashed} duplicates · updated ${summary.updated} bookmarks · ` +
              `${summary.collectionsCreated} collections created`,
          )
          await queryClient.invalidateQueries({ queryKey: queryKeys.aiSettings })
          await queryClient.invalidateQueries({ queryKey: queryKeys.insights })
          await queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.all })
          await queryClient.invalidateQueries({ queryKey: queryKeys.collections })
        },
        onError: (cause) =>
          setMessage(cause instanceof Error ? cause.message : 'apply failed'),
      },
    )
  }

  const configured = aiSettings.hasApiKey && aiSettings.model && aiSettings.baseUrl

  const [showDuplicates, setShowDuplicates] = useState(false)
  const duplicateGroups = useFindDuplicates(showDuplicates)
  const trashBookmark = useTrashBookmark()

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 p-6">
      <header className="flex items-center justify-between border-b border-line pb-4">
        <Link
          to="/"
          className="font-mono text-xs text-ink-muted transition-colors hover:text-ink"
        >
          ← pinshelf
        </Link>
        <span className="font-mono text-xs text-ink-faint">ai cleanup</span>
      </header>

      {!configured ? (
        <p className="border border-dashed border-line p-6 font-mono text-xs text-ink-faint">
          no AI provider configured — add a base URL, model, and API key in{' '}
          <Link to="/settings" className="text-accent underline underline-offset-4">
            settings
          </Link>
        </p>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <p className="font-mono text-[11px] text-ink-faint">
              sends {limit} bookmarks ({aiSettings.model} at {aiSettings.baseUrl}) and
              proposes duplicates to trash plus tags, descriptions, and collections to
              fill in. Collections are folders; tags are categories. Nothing is applied
              until you press apply, and duplicates go to trash, not deletion.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
                className="field px-2 py-1 font-mono text-xs"
                aria-label="Bookmarks to scan"
              >
                <option value={25}>scan 25</option>
                <option value={50}>scan 50</option>
                <option value={100}>scan 100</option>
                <option value={200}>scan 200</option>
                <option value={500}>scan 500</option>
              </select>
              <button
                type="button"
                className="btn-primary"
                disabled={scan.isPending}
                onClick={() => scan.mutate({ limit })}
              >
                {scan.isPending ? 'asking the model…' : 'Scan library'}
              </button>
              <button
                type="button"
                className="btn"
                disabled={scan.isPending || library.counts.unsorted === 0}
                onClick={() => scan.mutate({ limit: 500, onlyUnsorted: true })}
                title="Assign a collection to every bookmark that has none"
              >
                {scan.isPending
                  ? 'asking the model…'
                  : `tidy unsorted (${library.counts.unsorted})`}
              </button>
              {result && (
                <span className="font-mono text-[11px] text-ink-faint">
                  scanned {result.scanned} in {result.batches}{' '}
                  {result.batches === 1 ? 'batch' : 'batches'} · {duplicates.length}{' '}
                  duplicate groups · {updates.length} updates selected ·{' '}
                  {result.promptTokens + result.completionTokens} tokens
                  {result.tidy && result.unassigned > 0
                    ? ` · ${result.unassigned} still unassigned`
                    : ''}
                </span>
              )}
            </div>
            {library.counts.unsorted > 0 && (
              <p className="font-mono text-[11px] text-ink-faint">
                {library.counts.unsorted} active bookmarks have no collection — tidy
                unsorted scans only those, up to 500 at a time, and asks for a collection
                for every one of them.
              </p>
            )}
            {message && <p className="font-mono text-xs text-accent">{message}</p>}
            {scan.isError && (
              <p className="font-mono text-xs text-danger">
                {scan.error instanceof Error ? scan.error.message : 'scan failed'}
              </p>
            )}
          </section>

          {result && (
            <>
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-medium">Duplicates</h2>
                {result.proposals.duplicates.length === 0 ? (
                  <p className="font-mono text-[11px] text-ink-faint">
                    no duplicates found in this batch
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {result.proposals.duplicates.map((group, index) => (
                      <li key={group.keepId} className="panel flex gap-3 p-3">
                        <input
                          type="checkbox"
                          className="checkbox mt-1 h-3.5 w-3.5 shrink-0"
                          checked={!skippedDuplicates.has(index)}
                          onChange={() =>
                            setSkippedDuplicates((current) => {
                              const next = new Set(current)
                              if (next.has(index)) next.delete(index)
                              else next.add(index)
                              return next
                            })
                          }
                          aria-label={`Apply duplicate group keeping ${label(group.keepId)}`}
                        />
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="text-sm">
                            keep{' '}
                            <span className="font-medium">{label(group.keepId)}</span>
                          </span>
                          <span className="font-mono text-[11px] text-danger">
                            trash {group.removeIds.map(label).join(' · ')}
                          </span>
                          {group.reason && (
                            <span className="font-mono text-[11px] text-ink-faint">
                              {group.reason}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-medium">Tags, descriptions, collections</h2>
                {result.proposals.updates.length === 0 ? (
                  <p className="font-mono text-[11px] text-ink-faint">
                    no metadata suggestions in this batch
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {result.proposals.updates.map((update) => (
                      <li key={update.id} className="panel flex gap-3 p-3">
                        <input
                          type="checkbox"
                          className="checkbox mt-1 h-3.5 w-3.5 shrink-0"
                          checked={!skippedUpdates.has(update.id)}
                          onChange={() =>
                            setSkippedUpdates((current) => {
                              const next = new Set(current)
                              if (next.has(update.id)) next.delete(update.id)
                              else next.add(update.id)
                              return next
                            })
                          }
                          aria-label={`Apply suggestion for ${label(update.id)}`}
                        />
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="truncate text-sm">{label(update.id)}</span>
                          {update.tags && update.tags.length > 0 && (
                            <span className="font-mono text-[11px] text-ink-muted">
                              tags → {update.tags.join(', ')}
                            </span>
                          )}
                          {update.description && (
                            <span className="text-[13px] text-ink-muted">
                              {update.description}
                            </span>
                          )}
                          {update.collection && (
                            <span className="font-mono text-[11px] text-ink-faint">
                              collection → {update.collection}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <div className="flex items-center gap-2 border-t border-line pt-4">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={
                    applyCleanup.isPending || duplicates.length + updates.length === 0
                  }
                  onClick={apply}
                >
                  {applyCleanup.isPending ? 'applying…' : 'Apply selected'}
                </button>
                <span className="font-mono text-[11px] text-ink-faint">
                  duplicates are trashed and can be restored from the trash page
                </span>
              </div>
            </>
          )}
        </>
      )}

      <section className="flex flex-col gap-3 border-t border-line pt-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">Duplicates</h2>
          <p className="font-mono text-[11px] text-ink-faint">
            the same page saved twice with different query strings or trailing slashes —
            no AI needed
          </p>
        </div>

        {!showDuplicates && (
          <button
            type="button"
            className="btn self-start"
            onClick={() => setShowDuplicates(true)}
          >
            find duplicates
          </button>
        )}

        {showDuplicates && duplicateGroups.isFetching && (
          <p className="font-mono text-xs text-ink-faint">scanning…</p>
        )}

        {showDuplicates &&
          (duplicateGroups.data ?? []).map((group) => (
            <div key={group.key} className="flex flex-col gap-2 border border-line p-3">
              <span className="font-mono text-[11px] text-ink-faint">{group.key}</span>
              {group.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to="/bookmarks/$id"
                      params={{ id: item.id }}
                      className="truncate text-sm text-ink underline-offset-4 hover:underline"
                    >
                      {item.title || item.url}
                    </Link>
                    <p className="font-mono text-[11px] text-ink-faint">{item.url}</p>
                  </div>
                  <button
                    type="button"
                    className="btn shrink-0"
                    onClick={() => trashBookmark.mutate(item.id)}
                  >
                    trash
                  </button>
                </div>
              ))}
            </div>
          ))}

        {showDuplicates &&
          !duplicateGroups.isFetching &&
          (duplicateGroups.data ?? []).length === 0 && (
            <p className="font-mono text-xs text-ink-muted">
              nothing duplicated — the shelf is tidy
            </p>
          )}
      </section>
    </main>
  )
}
