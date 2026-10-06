import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import {
  createFileRoute,
  Link,
  notFound,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { AppHeader, PageHeading } from '~/components/AppHeader'
import { getAiSettings } from '~/lib/ai'
import type { AskMode } from '~/lib/ai-schemas'
import { getBookmark } from '~/lib/bookmarks'
import {
  queryKeys,
  useAddHighlight,
  useArchivePage,
  useAskBookmark,
  useCreateShare,
  useDeleteBookmark,
  useHighlights,
  useRefetchMetadata,
  useRemoveHighlight,
  useRestoreBookmark,
  useRevokeShare,
  useShareLinks,
  useTrashBookmark,
  useUpdateBookmark,
} from '~/lib/queries'
import { fetchSession } from '~/lib/session'
import { listCollections } from '~/lib/taxonomy'

const ASK_ACTIONS: { mode: AskMode; label: string }[] = [
  { mode: 'summary', label: 'summarise' },
  { mode: 'takeaways', label: 'key takeaways' },
  { mode: 'plain', label: 'explain simply' },
  { mode: 'verdict', label: 'worth reading?' },
]

export const Route = createFileRoute('/bookmarks/$id')({
  beforeLoad: async () => {
    const session = await fetchSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    return { session }
  },
  loader: async ({ context, params }) => {
    const [bookmark] = await Promise.all([
      context.queryClient.ensureQueryData({
        queryKey: queryKeys.bookmarks.detail(params.id),
        queryFn: () => getBookmark({ data: { id: params.id } }),
      }),
      context.queryClient.ensureQueryData({
        queryKey: queryKeys.collections,
        queryFn: () => listCollections(),
      }),
    ])
    if (!bookmark) throw notFound()
  },
  component: BookmarkDetail,
  notFoundComponent: BookmarkNotFound,
})

function BookmarkNotFound() {
  return (
    <main className="page">
      <AppHeader />
      <PageHeading title="bookmark" />
      <p className="empty">bookmark not found</p>
    </main>
  )
}

function BookmarkDetail() {
  const { id } = Route.useParams()
  const navigate = useNavigate()

  const { data: bookmark } = useSuspenseQuery({
    queryKey: queryKeys.bookmarks.detail(id),
    queryFn: () => getBookmark({ data: { id } }),
  })
  const { data: collections } = useSuspenseQuery({
    queryKey: queryKeys.collections,
    queryFn: () => listCollections(),
  })

  const updateBookmark = useUpdateBookmark()
  const refetchMetadata = useRefetchMetadata()
  const trashBookmark = useTrashBookmark()
  const restoreBookmark = useRestoreBookmark()
  const archivePage = useArchivePage()
  const createShare = useCreateShare()
  const revokeShare = useRevokeShare(id)
  const [archiveMessage, setArchiveMessage] = useState<string | null>(null)
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const [shareExpiryDays, setShareExpiryDays] = useState<number | null>(null)
  const { data: shareLinks = [] } = useShareLinks(id, true)
  const { data: highlights = [] } = useHighlights(id)
  const addHighlight = useAddHighlight(id)
  const removeHighlight = useRemoveHighlight(id)
  const askBookmark = useAskBookmark(id)
  const [askAnswer, setAskAnswer] = useState<{
    text: string
    source: string
  } | null>(null)
  const [askError, setAskError] = useState<string | null>(null)
  const { data: aiSettings } = useQuery({
    queryKey: queryKeys.aiSettings,
    queryFn: () => getAiSettings(),
    retry: false,
  })
  const [highlightQuote, setHighlightQuote] = useState('')
  const [highlightNote, setHighlightNote] = useState('')
  const deleteBookmark = useDeleteBookmark()

  if (!bookmark) {
    return <BookmarkNotFound />
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!bookmark) return
    const form = new FormData(event.currentTarget)
    const collectionId = String(form.get('collectionId') ?? '')
    updateBookmark.mutate({
      id: bookmark.id,
      title: String(form.get('title') ?? ''),
      description: String(form.get('description') ?? ''),
      notes: String(form.get('notes') ?? ''),
      tags: String(form.get('tags') ?? '').split(','),
      collectionId: collectionId || null,
    })
  }

  return (
    <main className="page">
      <AppHeader />

      <PageHeading
        title="bookmark"
        note={<span className="block truncate">{bookmark.url}</span>}
      >
        {bookmark.archiveStatus === 'done' && (
          <a
            className="btn bg-sky"
            href={`/archive/${bookmark.id}`}
            target="_blank"
            rel="noreferrer"
          >
            view snapshot
          </a>
        )}
        <a href={bookmark.url} target="_blank" rel="noreferrer" className="btn-primary">
          open original ↗
        </a>
      </PageHeading>

      <form onSubmit={save} className="panel">
        <div className="panel-head bg-accent">
          <h2 className="section-title">details</h2>
          <span className="flex flex-wrap items-center gap-1.5">
            <span
              className={`chip ${bookmark.metadataStatus === 'failed' ? 'text-warn' : ''}`}
            >
              metadata: {bookmark.metadataStatus} ({bookmark.metadataAttempts})
            </span>
            {bookmark.archiveStatus !== 'none' && (
              <span
                className={`chip ${bookmark.archiveStatus === 'failed' ? 'text-warn' : ''}`}
              >
                archive: {bookmark.archiveStatus}
              </span>
            )}
          </span>
        </div>

        <div className="flex flex-col gap-4 p-4">
          {/* The preview image sits beside title and description, like the card it makes. */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            {bookmark.ogImageUrl && (
              <img
                src={bookmark.ogImageUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="max-h-48 max-w-full shrink-0 self-start rounded-md border-2 border-line shadow-hard-sm sm:order-last sm:mt-5.5 sm:max-w-52"
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="label" htmlFor="title">
                  title
                </label>
                <input
                  id="title"
                  name="title"
                  defaultValue={bookmark.title ?? ''}
                  className="field text-lg font-semibold"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="label" htmlFor="description">
                  description
                </label>
                <textarea
                  id="description"
                  name="description"
                  defaultValue={bookmark.description ?? ''}
                  rows={3}
                  className="field resize-y leading-relaxed"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="label" htmlFor="notes">
              notes
            </label>
            <textarea
              id="notes"
              name="notes"
              defaultValue={bookmark.notes ?? ''}
              rows={4}
              className="field resize-y leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="label" htmlFor="tags">
                tags
              </label>
              <input
                id="tags"
                name="tags"
                defaultValue={bookmark.tags.join(', ')}
                placeholder="comma separated"
                className="field font-mono text-xs"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="label" htmlFor="collectionId">
                collection
              </label>
              <select
                id="collectionId"
                name="collectionId"
                defaultValue={bookmark.collectionId ?? ''}
                className="field font-mono text-xs"
              >
                <option value="">no collection</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t-2 border-line px-4 py-3">
          <button
            type="submit"
            className="btn-primary"
            disabled={updateBookmark.isPending}
          >
            {updateBookmark.isPending ? 'saving…' : 'Save'}
          </button>
          <button
            type="button"
            className="btn"
            disabled={refetchMetadata.isPending}
            onClick={() => refetchMetadata.mutate(bookmark.id)}
          >
            {refetchMetadata.isPending ? 'refetching…' : 'refetch metadata'}
          </button>
          <button
            type="button"
            className="btn bg-mint"
            disabled={archivePage.isPending}
            onClick={() =>
              archivePage.mutate(bookmark.id, {
                onSuccess: (result) =>
                  setArchiveMessage(
                    result.status === 'done'
                      ? 'snapshot saved'
                      : 'the page could not be archived',
                  ),
              })
            }
          >
            {archivePage.isPending ? 'archiving…' : 'archive page'}
          </button>
          {archiveMessage && (
            <p
              className={`font-mono text-xs font-semibold ${archiveMessage === 'snapshot saved' ? 'text-ok' : 'text-danger'}`}
            >
              {archiveMessage}
            </p>
          )}
          {/* Whole-bookmark actions sit at the far end, away from Save. */}
          <span className="ml-auto flex flex-wrap items-center gap-2">
            {bookmark.status === 'active' ? (
              <button
                type="button"
                className="btn"
                onClick={() => trashBookmark.mutate(bookmark.id)}
              >
                move to trash
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn bg-mint"
                  onClick={() => restoreBookmark.mutate(bookmark.id)}
                >
                  restore
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() =>
                    deleteBookmark.mutate(bookmark.id, {
                      onSuccess: () =>
                        void navigate({ to: '/archive', search: { status: 'trashed' } }),
                    })
                  }
                >
                  delete forever
                </button>
              </>
            )}
          </span>
        </div>
      </form>

      <section className="panel">
        <div className="panel-head bg-sky">
          <h2 className="section-title">share</h2>
          {shareLinks.length > 0 && <span className="chip">{shareLinks.length}</span>}
        </div>
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-stretch gap-2">
            <select
              value={shareExpiryDays ?? ''}
              onChange={(event) =>
                setShareExpiryDays(event.target.value ? Number(event.target.value) : null)
              }
              aria-label="Link expiry"
              className="field font-mono text-xs"
            >
              <option value="">never expires</option>
              <option value="7">expires in 7 days</option>
              <option value="30">expires in 30 days</option>
            </select>
            <button
              type="button"
              className="btn"
              disabled={createShare.isPending}
              onClick={() =>
                createShare.mutate(
                  { id: bookmark.id, expiresInDays: shareExpiryDays },
                  {
                    onSuccess: (link) => {
                      const url = `${window.location.origin}/s/${link.token}`
                      void navigator.clipboard.writeText(url).catch(() => undefined)
                      setShareMessage(`link copied · ${url}`)
                    },
                    onError: (cause) =>
                      setShareMessage(
                        cause instanceof Error
                          ? cause.message
                          : 'could not create a link',
                      ),
                  },
                )
              }
            >
              {createShare.isPending ? 'creating…' : 'create link'}
            </button>
          </div>

          {shareMessage && (
            <p
              className={`font-mono text-xs font-semibold break-all ${shareMessage.startsWith('link copied') ? 'text-ok' : 'text-danger'}`}
            >
              {shareMessage}
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {shareLinks.map((link) => (
              <li
                key={link.id}
                className="tile flex flex-wrap items-center justify-between gap-x-3 gap-y-2 p-3"
              >
                <a
                  href={`/s/${link.token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="link min-w-0 truncate font-mono text-xs leading-6"
                >
                  /s/{link.token}
                </a>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-[11px] text-ink-faint">
                    {link.expiresAt
                      ? `expires ${new Date(link.expiresAt).toLocaleDateString()}`
                      : 'no expiry'}
                  </span>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => revokeShare.mutate(link.id)}
                  >
                    revoke
                  </button>
                </span>
              </li>
            ))}
            {shareLinks.length === 0 && (
              <li className="empty py-5">no public links — this bookmark is private</li>
            )}
          </ul>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head bg-lilac">
          <h2 className="section-title">ask</h2>
        </div>
        <div className="flex flex-col gap-3 p-4">
          {aiSettings && !aiSettings.hasApiKey ? (
            <p className="font-mono text-xs text-ink-muted">
              add an AI provider in{' '}
              <Link to="/settings" className="link">
                settings
              </Link>{' '}
              to summarise this page
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {ASK_ACTIONS.map((action) => (
                  <button
                    key={action.mode}
                    type="button"
                    className="btn bg-lilac"
                    disabled={askBookmark.isPending}
                    onClick={() => {
                      setAskError(null)
                      askBookmark.mutate(action.mode, {
                        onSuccess: (answer) => {
                          setAskAnswer(answer)
                          setAskError(null)
                        },
                        onError: (cause) => {
                          setAskAnswer(null)
                          setAskError(
                            cause instanceof Error ? cause.message : 'could not ask',
                          )
                        },
                      })
                    }}
                  >
                    {askBookmark.isPending && askBookmark.variables === action.mode
                      ? 'thinking…'
                      : action.label}
                  </button>
                ))}
              </div>
              {askError && (
                <p className="font-mono text-xs font-semibold text-danger">{askError}</p>
              )}
              {askAnswer && (
                <div className="well flex flex-col gap-2 p-4">
                  <p className="text-[15px] leading-relaxed whitespace-pre-line text-ink">
                    {askAnswer.text}
                  </p>
                  <span className="font-mono text-[11px] text-ink-faint">
                    read from{' '}
                    {askAnswer.source === 'archive' ? 'the snapshot' : askAnswer.source}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head bg-pink">
          <h2 className="section-title">highlights</h2>
          {highlights.length > 0 && <span className="chip">{highlights.length}</span>}
        </div>
        <div className="flex flex-col gap-4 p-4">
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              addHighlight.mutate(
                { quote: highlightQuote, note: highlightNote || null },
                {
                  onSuccess: () => {
                    setHighlightQuote('')
                    setHighlightNote('')
                  },
                },
              )
            }}
          >
            <textarea
              required
              value={highlightQuote}
              onChange={(event) => setHighlightQuote(event.target.value)}
              placeholder="paste the passage you want to keep"
              aria-label="Highlight text"
              className="field min-h-20 resize-y leading-relaxed"
            />
            <div className="flex gap-2">
              <input
                value={highlightNote}
                onChange={(event) => setHighlightNote(event.target.value)}
                placeholder="why it matters (optional)"
                aria-label="Highlight note"
                className="field min-w-0 flex-1"
              />
              <button
                type="submit"
                className="btn bg-pink px-4"
                disabled={addHighlight.isPending || !highlightQuote.trim()}
              >
                add
              </button>
            </div>
          </form>

          <ul className="flex flex-col gap-3">
            {highlights.map((highlight) => (
              <li
                key={highlight.id}
                className="tile flex flex-col gap-3 p-3 sm:flex-row sm:items-start"
              >
                <blockquote className="min-w-0 flex-1 border-l-4 border-accent pl-3 text-[15px] leading-relaxed text-ink">
                  {highlight.quote}
                  {highlight.note && (
                    <span className="mt-1.5 block font-mono text-xs text-ink-muted">
                      {highlight.note}
                    </span>
                  )}
                </blockquote>
                <button
                  type="button"
                  className="btn btn-danger shrink-0 self-end sm:self-start"
                  aria-label="Delete highlight"
                  onClick={() => removeHighlight.mutate(highlight.id)}
                >
                  delete
                </button>
              </li>
            ))}
            {highlights.length === 0 && (
              <li className="empty py-5">
                no highlights yet — keep the lines worth rereading
              </li>
            )}
          </ul>
        </div>
      </section>
    </main>
  )
}
