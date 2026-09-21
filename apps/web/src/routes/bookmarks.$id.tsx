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
import { SignOut } from '~/components/SignOut'
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
})

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
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 p-6">
        <p className="font-mono text-xs text-ink-faint">bookmark not found</p>
      </main>
    )
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
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 p-6">
      <header className="flex items-center justify-between border-b border-line pb-4">
        <Link
          to="/"
          className="font-mono text-xs text-ink-muted transition-colors hover:text-ink"
        >
          ← pinshelf
        </Link>
        <div className="flex items-center gap-4">
          <a
            href={bookmark.url}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-ink-muted transition-colors hover:text-ink"
          >
            open original ↗
          </a>
          <SignOut />
        </div>
      </header>

      <p className="truncate font-mono text-xs text-ink-faint">{bookmark.url}</p>

      <form onSubmit={save} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="label" htmlFor="title">
            title
          </label>
          <input
            id="title"
            name="title"
            defaultValue={bookmark.title ?? ''}
            className="field text-base"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="label" htmlFor="description">
            description
          </label>
          <textarea
            id="description"
            name="description"
            defaultValue={bookmark.description ?? ''}
            rows={2}
            className="field resize-y"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="label" htmlFor="notes">
            notes
          </label>
          <textarea
            id="notes"
            name="notes"
            defaultValue={bookmark.notes ?? ''}
            rows={4}
            className="field resize-y"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
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
          <div className="flex flex-col gap-1">
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

        <div className="flex flex-wrap items-center gap-2">
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
            className="btn"
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
          {bookmark.archiveStatus === 'done' && (
            <a
              className="btn"
              href={`/archive/${bookmark.id}`}
              target="_blank"
              rel="noreferrer"
            >
              view snapshot
            </a>
          )}
          <span className="font-mono text-[11px] text-ink-faint">
            metadata: {bookmark.metadataStatus} ({bookmark.metadataAttempts})
            {bookmark.archiveStatus !== 'none'
              ? ` · archive: ${bookmark.archiveStatus}`
              : ''}
          </span>
        </div>
        {archiveMessage && (
          <p className="font-mono text-xs text-ink-muted">{archiveMessage}</p>
        )}
      </form>

      <section className="flex flex-col gap-2 border-t border-line pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="label">share</span>
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
                      cause instanceof Error ? cause.message : 'could not create a link',
                    ),
                },
              )
            }
          >
            {createShare.isPending ? 'creating…' : 'create link'}
          </button>
          <select
            value={shareExpiryDays ?? ''}
            onChange={(event) =>
              setShareExpiryDays(event.target.value ? Number(event.target.value) : null)
            }
            aria-label="Link expiry"
            className="field font-mono"
          >
            <option value="">never expires</option>
            <option value="7">expires in 7 days</option>
            <option value="30">expires in 30 days</option>
          </select>
        </div>

        <ul className="flex flex-col gap-1.5">
          {shareLinks.map((link) => (
            <li key={link.id} className="flex items-center justify-between gap-3">
              <a
                href={`/s/${link.token}`}
                target="_blank"
                rel="noreferrer"
                className="truncate font-mono text-[11px] text-ink-muted underline-offset-4 hover:underline"
              >
                /s/{link.token}
              </a>
              <span className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-[11px] text-ink-faint">
                  {link.expiresAt
                    ? `expires ${new Date(link.expiresAt).toLocaleDateString()}`
                    : 'no expiry'}
                </span>
                <button
                  type="button"
                  className="btn"
                  onClick={() => revokeShare.mutate(link.id)}
                >
                  revoke
                </button>
              </span>
            </li>
          ))}
          {shareLinks.length === 0 && (
            <li className="font-mono text-[11px] text-ink-faint">
              no public links — this bookmark is private
            </li>
          )}
        </ul>
        {shareMessage && (
          <p className="font-mono text-xs text-ink-muted">{shareMessage}</p>
        )}
      </section>

      {bookmark.ogImageUrl && (
        <img
          src={bookmark.ogImageUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="max-h-64 w-fit rounded-lg border border-line"
        />
      )}

      <section className="flex flex-col gap-2 border-t border-line pt-4">
        <span className="label">ask</span>

        {aiSettings && !aiSettings.hasApiKey ? (
          <p className="font-mono text-[11px] text-ink-faint">
            add an AI provider in{' '}
            <Link to="/settings" className="text-accent underline underline-offset-4">
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
                  className="btn"
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
            {askError && <p className="font-mono text-xs text-danger">{askError}</p>}
            {askAnswer && (
              <div className="panel flex flex-col gap-1 p-3">
                <p className="text-[13px] leading-relaxed whitespace-pre-line">
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
      </section>

      <section className="flex flex-col gap-2 border-t border-line pt-4">
        <span className="label">highlights</span>

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
            className="field min-h-20 font-mono text-[13px]"
          />
          <div className="flex gap-2">
            <input
              value={highlightNote}
              onChange={(event) => setHighlightNote(event.target.value)}
              placeholder="why it matters (optional)"
              aria-label="Highlight note"
              className="field flex-1"
            />
            <button
              type="submit"
              className="btn"
              disabled={addHighlight.isPending || !highlightQuote.trim()}
            >
              add
            </button>
          </div>
        </form>

        <ul className="flex flex-col gap-2">
          {highlights.map((highlight) => (
            <li key={highlight.id} className="panel flex items-start gap-3 p-3">
              <blockquote className="min-w-0 flex-1 border-l-2 border-accent pl-3 text-[13px] leading-relaxed text-ink-muted">
                {highlight.quote}
                {highlight.note && (
                  <span className="mt-1 block font-mono text-[11px] text-ink-faint">
                    {highlight.note}
                  </span>
                )}
              </blockquote>
              <button
                type="button"
                className="btn shrink-0"
                aria-label="Delete highlight"
                onClick={() => removeHighlight.mutate(highlight.id)}
              >
                delete
              </button>
            </li>
          ))}
          {highlights.length === 0 && (
            <li className="font-mono text-[11px] text-ink-faint">
              no highlights yet — keep the lines worth rereading
            </li>
          )}
        </ul>
      </section>

      <div className="flex items-center gap-2 border-t border-line pt-4">
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
              className="btn"
              onClick={() => restoreBookmark.mutate(bookmark.id)}
            >
              restore
            </button>
            <button
              type="button"
              className="btn"
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
      </div>
    </main>
  )
}
