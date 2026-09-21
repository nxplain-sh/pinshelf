import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getAiSettings, scanCleanup } from '~/lib/ai'
import type { AiProposals, TagMergeSuggestion } from '~/lib/ai-schemas'
import { listBookmarks } from '~/lib/bookmarks'
import type { BookmarkFilters } from '~/lib/bookmarks.types'
import { insights } from '~/lib/library'
import {
  queryKeys,
  useApplyCleanup,
  useFindDuplicates,
  useMergeTag,
  useSuggestTagMerges,
  useTrashBookmark,
} from '~/lib/queries'

const activeFilters: BookmarkFilters = { status: 'active' }

const PUBLIC_PATHS = ['/login', '/two-factor', '/share']

export function Toolbox() {
  const path = useRouterState({ select: (state) => state.location.pathname })
  const [open, setOpen] = useState(false)
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
  const [showDuplicates, setShowDuplicates] = useState(false)

  const queryClient = useQueryClient()
  const applyCleanup = useApplyCleanup()

  const aiSettingsQuery = useQuery({
    queryKey: queryKeys.aiSettings,
    queryFn: () => getAiSettings(),
    enabled: open,
    retry: false,
  })
  const bookmarksQuery = useQuery({
    queryKey: queryKeys.bookmarks.list(activeFilters),
    queryFn: () => listBookmarks({ data: activeFilters }),
    enabled: open,
  })
  const insightsQuery = useQuery({
    queryKey: queryKeys.insights,
    queryFn: () => insights(),
    enabled: open,
  })

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

  const duplicateGroups = useFindDuplicates(showDuplicates)
  const trashBookmark = useTrashBookmark()

  const suggestMerges = useSuggestTagMerges()
  const mergeTag = useMergeTag()
  const [merges, setMerges] = useState<TagMergeSuggestion[] | null>(null)
  const [skippedMerges, setSkippedMerges] = useState<Set<string>>(new Set())
  const [mergeMessage, setMergeMessage] = useState<string | null>(null)
  const selectedMerges = (merges ?? []).filter(
    (merge) => !skippedMerges.has(merge.fromId),
  )

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (PUBLIC_PATHS.includes(path) || path.startsWith('/s/')) return null

  const aiSettings = aiSettingsQuery.data
  const library = insightsQuery.data
  const bookmarks = bookmarksQuery.data ?? []
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

  const configured = Boolean(
    aiSettings?.hasApiKey && aiSettings.model && aiSettings.baseUrl,
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

  return (
    <>
      <button
        type="button"
        className="btn fixed right-5 bottom-5 z-40 border-accent/50 bg-surface text-accent"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        toolbox
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="close toolbox"
            className="absolute inset-0 cursor-default bg-canvas/70"
            onClick={() => setOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label="toolbox"
            className="relative flex h-full w-full max-w-md flex-col border-l border-line bg-surface"
          >
            <header className="flex items-center justify-between border-b border-line px-5 py-3">
              <h2 className="font-mono text-xs text-ink-muted">toolbox</h2>
              <button
                type="button"
                className="font-mono text-xs text-ink-muted hover:text-ink"
                onClick={() => setOpen(false)}
              >
                close
              </button>
            </header>

            <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
              {aiSettingsQuery.isPending ? (
                <p className="font-mono text-xs text-ink-faint">loading…</p>
              ) : configured && aiSettings ? (
                <>
                  <section className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={limit}
                        onChange={(event) => setLimit(Number(event.target.value))}
                        className="field px-2 py-1 font-mono text-xs"
                        aria-label="Bookmarks to scan"
                      >
                        {[25, 50, 100, 200, 500].map((count) => (
                          <option key={count} value={count}>
                            scan {count}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={scan.isPending}
                        onClick={() => scan.mutate({ limit })}
                      >
                        {scan.isPending ? 'asking the model…' : 'scan library'}
                      </button>
                      <button
                        type="button"
                        className="btn"
                        disabled={
                          scan.isPending || !library || library.counts.unsorted === 0
                        }
                        onClick={() => scan.mutate({ limit: 500, onlyUnsorted: true })}
                        title="Assign a collection to every bookmark that has none"
                      >
                        tidy unsorted ({library?.counts.unsorted ?? 0})
                      </button>
                    </div>
                    <p className="font-mono text-[11px] text-ink-faint">
                      sends {limit} bookmarks to {aiSettings.model} · nothing applies
                      until you press apply · duplicates go to trash, not deletion
                    </p>
                    {result && (
                      <p className="font-mono text-[11px] text-ink-faint">
                        scanned {result.scanned} in {result.batches}{' '}
                        {result.batches === 1 ? 'batch' : 'batches'} · {duplicates.length}{' '}
                        duplicate groups · {updates.length} updates selected ·{' '}
                        {result.promptTokens + result.completionTokens} tokens
                        {result.tidy && result.unassigned > 0
                          ? ` · ${result.unassigned} still unassigned`
                          : ''}
                      </p>
                    )}
                    {message && (
                      <p className="font-mono text-xs text-accent">{message}</p>
                    )}
                    {scan.isError && (
                      <p className="font-mono text-xs text-danger">
                        {scan.error instanceof Error ? scan.error.message : 'scan failed'}
                      </p>
                    )}
                  </section>

                  {result && (
                    <>
                      <section className="flex flex-col gap-2">
                        <h3 className="text-sm font-medium">Duplicates</h3>
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
                                    <span className="font-medium">
                                      {label(group.keepId)}
                                    </span>
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
                        <h3 className="text-sm font-medium">
                          Tags, descriptions, collections
                        </h3>
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
                                  <span className="truncate text-sm">
                                    {label(update.id)}
                                  </span>
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

                      <div className="flex flex-col gap-2 border-t border-line pt-4">
                        <button
                          type="button"
                          className="btn-primary self-start"
                          disabled={
                            applyCleanup.isPending ||
                            duplicates.length + updates.length === 0
                          }
                          onClick={apply}
                        >
                          {applyCleanup.isPending ? 'applying…' : 'apply selected'}
                        </button>
                        <span className="font-mono text-[11px] text-ink-faint">
                          duplicates are trashed and can be restored from the trash view
                        </span>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <p className="border border-dashed border-line p-4 font-mono text-xs text-ink-faint">
                  no AI provider configured — add a base URL, model, and API key in{' '}
                  <Link
                    to="/settings"
                    className="text-accent underline underline-offset-4"
                  >
                    settings
                  </Link>
                </p>
              )}

              <section className="flex flex-col gap-3 border-t border-line pt-5">
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-medium">Tags</h3>
                  <p className="font-mono text-[11px] text-ink-faint">
                    merges tags that mean the same thing — {aiSettings?.model} proposes,
                    you pick
                  </p>
                </div>

                <button
                  type="button"
                  className="btn self-start"
                  disabled={suggestMerges.isPending}
                  onClick={() => {
                    setMergeMessage(null)
                    suggestMerges.mutate(undefined, {
                      onSuccess: (list) => {
                        setMerges(list)
                        setSkippedMerges(new Set())
                        if (list.length === 0) setMergeMessage('no near-duplicates')
                      },
                      onError: (cause: unknown) =>
                        setMergeMessage(
                          cause instanceof Error ? cause.message : 'could not read tags',
                        ),
                    })
                  }}
                >
                  {suggestMerges.isPending ? 'reading tags…' : 'suggest merges'}
                </button>

                {mergeMessage && (
                  <p className="font-mono text-xs text-ink-muted">{mergeMessage}</p>
                )}

                {merges && merges.length > 0 && (
                  <ul className="flex flex-col gap-1.5">
                    {merges.map((merge) => (
                      <li key={merge.fromId} className="panel flex gap-3 p-3">
                        <input
                          type="checkbox"
                          className="checkbox mt-1 h-3.5 w-3.5 shrink-0"
                          checked={!skippedMerges.has(merge.fromId)}
                          onChange={() =>
                            setSkippedMerges((current) => {
                              const next = new Set(current)
                              if (next.has(merge.fromId)) next.delete(merge.fromId)
                              else next.add(merge.fromId)
                              return next
                            })
                          }
                          aria-label={`Apply merging ${merge.from} into ${merge.into}`}
                        />
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="text-sm">
                            {merge.from}{' '}
                            <span className="font-mono text-[11px] text-ink-faint">
                              into
                            </span>{' '}
                            <span className="font-medium">{merge.into}</span>
                          </span>
                          {merge.reason && (
                            <span className="font-mono text-[11px] text-ink-faint">
                              {merge.reason}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {selectedMerges.length > 0 && (
                  <button
                    type="button"
                    className="btn-primary self-start"
                    disabled={mergeTag.isPending}
                    onClick={async () => {
                      setMergeMessage(null)
                      let merged = 0
                      for (const merge of selectedMerges) {
                        try {
                          await mergeTag.mutateAsync({
                            fromId: merge.fromId,
                            intoId: merge.intoId,
                          })
                          merged++
                        } catch {
                          break
                        }
                      }
                      await queryClient.invalidateQueries({ queryKey: queryKeys.tags })
                      setMerges(null)
                      setSkippedMerges(new Set())
                      setMergeMessage(`merged ${merged} tags`)
                    }}
                  >
                    {mergeTag.isPending
                      ? 'merging…'
                      : `merge ${selectedMerges.length} tags`}
                  </button>
                )}
              </section>

              <section className="flex flex-col gap-3 border-t border-line pt-5">
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-medium">Duplicates</h3>
                  <p className="font-mono text-[11px] text-ink-faint">
                    the same page saved twice with different query strings or trailing
                    slashes — no AI needed
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
                    <div
                      key={group.key}
                      className="flex flex-col gap-2 border border-line p-3"
                    >
                      <span className="font-mono text-[11px] text-ink-faint">
                        {group.key}
                      </span>
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <Link
                              to="/bookmarks/$id"
                              params={{ id: item.id }}
                              className="truncate text-sm text-ink underline-offset-4 hover:underline"
                            >
                              {item.title || item.url}
                            </Link>
                            <p className="truncate font-mono text-[11px] text-ink-faint">
                              {item.url}
                            </p>
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
            </div>
          </section>
        </div>
      )}
    </>
  )
}
