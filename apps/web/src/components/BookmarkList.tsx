import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Logo } from '~/components/Logo'
import type { BookmarkListItem } from '~/lib/bookmarks.types'
import {
  useArchiveBookmark,
  useArchivePage,
  useBookmarkReader,
  useDeleteBookmark,
  useRestoreBookmark,
  useTrashBookmark,
} from '~/lib/queries'
import { tagTone } from '~/lib/tag-tone'

function faviconFor(bookmark: BookmarkListItem): string | null {
  return bookmark.faviconUrl ?? null
}

function hostFor(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function moveId(ids: string[], from: string, to: string): string[] {
  const next = ids.filter((id) => id !== from)
  const target = next.indexOf(to)
  next.splice(target === -1 ? next.length : target, 0, from)
  return next
}

export function BookmarkList({
  bookmarks,
  selectable = false,
  selected,
  onToggle,
  onToggleAll,
  manual = false,
  onReorder,
  activeId,
}: {
  bookmarks: BookmarkListItem[]
  selectable?: boolean
  selected?: Set<string>
  onToggle?: (id: string) => void
  onToggleAll?: (ids: string[]) => void
  manual?: boolean
  onReorder?: (ids: string[]) => void
  activeId?: string | null
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const draggable = manual && Boolean(onReorder)
  const trashBookmark = useTrashBookmark()
  const archivePage = useArchivePage()
  const [preview, setPreview] = useState<BookmarkListItem | null>(null)
  const restoreBookmark = useRestoreBookmark()
  const archiveBookmark = useArchiveBookmark()
  const deleteBookmark = useDeleteBookmark()

  const selectAllRef = useRef<HTMLInputElement>(null)
  const allSelected =
    bookmarks.length > 0 && bookmarks.every((bookmark) => selected?.has(bookmark.id))
  const someSelected = bookmarks.some((bookmark) => selected?.has(bookmark.id))

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected
    }
  }, [someSelected, allSelected])

  useEffect(() => {
    if (!preview) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setPreview(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview])

  if (bookmarks.length === 0) {
    return <p className="empty">nothing here yet</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {selectable && onToggleAll && (
        <div className="flex items-center gap-2.5 pl-4.5">
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allSelected}
            onChange={() => onToggleAll(bookmarks.map((bookmark) => bookmark.id))}
            className="checkbox"
            aria-label="Select all visible bookmarks"
          />
          <span className="font-mono text-[11px] font-semibold text-ink-muted">
            {allSelected ? 'clear selection' : `select all ${bookmarks.length}`}
          </span>
        </div>
      )}
      <ul className="flex flex-col gap-3">
        {bookmarks.map((bookmark) => {
          const favicon = faviconFor(bookmark)
          const active = activeId === bookmark.id
          const over = overId === bookmark.id
          const dragging = dragId === bookmark.id
          // Rows lift off their shadow on hover, like buttons. Never while a drag
          // is running: a moving row under the pointer makes drop targets flicker.
          const lift = dragging
            ? 'border-dashed opacity-50'
            : active
              ? '-translate-0.5 shadow-hard-lg'
              : dragId
                ? 'shadow-hard'
                : 'shadow-hard hover:-translate-0.5 hover:shadow-hard-lg'
          return (
            <li
              key={bookmark.id}
              data-bookmark-id={bookmark.id}
              draggable={draggable}
              onDragStart={(event) => {
                setDragId(bookmark.id)
                event.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(event) => {
                if (!draggable || !dragId || dragId === bookmark.id) return
                event.preventDefault()
                setOverId(bookmark.id)
              }}
              onDragLeave={() =>
                setOverId((current) => (current === bookmark.id ? null : current))
              }
              onDrop={(event) => {
                event.preventDefault()
                if (draggable && dragId && dragId !== bookmark.id) {
                  onReorder?.(
                    moveId(
                      bookmarks.map((entry) => entry.id),
                      dragId,
                      bookmark.id,
                    ),
                  )
                }
                setDragId(null)
                setOverId(null)
              }}
              onDragEnd={() => {
                setDragId(null)
                setOverId(null)
              }}
              className={`group relative grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3 rounded-lg border-2 border-line p-4 transition-[translate,box-shadow,opacity] duration-150 ease-out ${lift} ${over ? 'bg-surface-hover' : 'bg-surface'} ${
                // Keyboard highlight (j/k): a solid accent spine down the left edge.
                active
                  ? 'before:absolute before:inset-y-0 before:left-0 before:w-2 before:rounded-l-[calc(var(--radius-lg)-2px)] before:border-r-2 before:border-line before:bg-accent'
                  : ''
              } ${
                // Drop target: a bar in the gap above, where the dragged row lands.
                over
                  ? 'after:pointer-events-none after:absolute after:inset-x-2 after:-top-[11px] after:h-2 after:rounded-full after:border-2 after:border-line after:bg-accent'
                  : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {draggable && (
                  <span
                    aria-hidden="true"
                    className="mt-1 shrink-0 cursor-grab font-mono text-base leading-none text-ink-muted select-none"
                  >
                    ⠿
                  </span>
                )}
                {selectable && (
                  <input
                    type="checkbox"
                    checked={selected?.has(bookmark.id) ?? false}
                    onChange={() => onToggle?.(bookmark.id)}
                    className="checkbox mt-1.5"
                    aria-label={`Select ${bookmark.title || bookmark.url}`}
                  />
                )}
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-md border-2 border-line transition-colors ${
                    active ? 'bg-accent' : 'bg-surface'
                  }`}
                >
                  {favicon ? (
                    <img
                      src={favicon}
                      alt=""
                      width={16}
                      height={16}
                      referrerPolicy="no-referrer"
                      className="size-4"
                    />
                  ) : (
                    // No favicon: the mark at ink-faint, never at full brass, so a
                    // list of them does not light up (docs/design.md rule 9).
                    <Logo size={16} mono />
                  )}
                </span>
              </div>

              <div className="flex min-w-0 flex-col gap-1">
                <Link
                  to="/bookmarks/$id"
                  params={{ id: bookmark.id }}
                  className="line-clamp-2 self-start text-[15px] leading-snug font-semibold text-ink decoration-accent decoration-2 underline-offset-4 wrap-anywhere hover:underline"
                >
                  {bookmark.title || bookmark.url}
                </Link>
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-0 truncate font-mono text-[11px] text-ink-faint">
                    {hostFor(bookmark.url)}
                  </span>
                  {bookmark.collectionName && (
                    <span className="chip bg-surface-hover">
                      /{bookmark.collectionName}
                    </span>
                  )}
                </div>
                {bookmark.description && (
                  <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-muted">
                    {bookmark.description}
                  </p>
                )}
                {bookmark.metadataStatus === 'failed' && (
                  <p className="mt-1 font-mono text-[11px] font-semibold text-warn">
                    metadata fetch failed
                  </p>
                )}
                {bookmark.linkStatus === 'broken' && (
                  <p className="mt-1 font-mono text-[11px] font-semibold text-warn">
                    link looks broken
                  </p>
                )}
              </div>

              {/* Phones: tags, then the actions as a full-width bar along the bottom. */}
              <div className="col-span-full flex flex-wrap items-center gap-x-3 gap-y-3 sm:col-span-1 sm:col-start-2">
                {bookmark.tags.length > 0 && (
                  <div className="mr-auto flex flex-wrap gap-1.5">
                    {bookmark.tags.slice(0, 6).map((tag) => (
                      <span key={tag} className={`chip ${tagTone(tag)}`}>
                        {tag}
                      </span>
                    ))}
                    {bookmark.tags.length > 6 && (
                      <span className="chip">+{bookmark.tags.length - 6}</span>
                    )}
                  </div>
                )}
                <div
                  className={`flex flex-wrap items-center gap-1.5 max-sm:w-full max-sm:border-t-2 max-sm:border-line-soft max-sm:pt-3 max-sm:*:flex-1 sm:ml-auto ${
                    // The keyboard highlight shows its row's actions too.
                    active
                      ? ''
                      : 'sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100'
                  }`}
                >
                  <button
                    type="button"
                    className="btn bg-sky"
                    onClick={() => setPreview(bookmark)}
                  >
                    preview
                  </button>
                  {bookmark.status === 'active' && (
                    <>
                      <a
                        href={bookmark.url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn"
                      >
                        open
                      </a>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => archiveBookmark.mutate(bookmark.id)}
                      >
                        archive
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => trashBookmark.mutate(bookmark.id)}
                      >
                        trash
                      </button>
                    </>
                  )}
                  {bookmark.status === 'archived' && (
                    <>
                      <button
                        type="button"
                        className="btn bg-mint"
                        onClick={() => restoreBookmark.mutate(bookmark.id)}
                      >
                        unarchive
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => trashBookmark.mutate(bookmark.id)}
                      >
                        trash
                      </button>
                    </>
                  )}
                  {bookmark.status === 'trashed' && (
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
                        onClick={() => deleteBookmark.mutate(bookmark.id)}
                      >
                        delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {preview && (
        <div className="overlay flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`preview of ${preview.title || preview.url}`}
            className="dialog flex h-[70vh] max-h-[640px] min-h-0 w-full max-w-3xl flex-col"
          >
            <header className="panel-head rounded-t-[calc(var(--radius-xl)-2px)] bg-sky">
              {/* Phones: the buttons drop under the title instead of squeezing it. */}
              <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
                <span className="truncate text-sm font-bold text-ink">
                  {preview.title || preview.url}
                </span>
                <span className="truncate font-mono text-[11px] text-ink-muted">
                  {preview.url}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a href={preview.url} target="_blank" rel="noreferrer" className="btn">
                  open original
                </a>
                <button type="button" className="btn" onClick={() => setPreview(null)}>
                  close
                </button>
              </div>
            </header>

            <ReaderBody id={preview.id} archivePage={archivePage} />
          </div>
        </div>
      )}
    </div>
  )
}

/** Reader view: readable text from the snapshot or a live fetch, never a blocked frame. */
function ReaderBody({
  id,
  archivePage,
}: {
  id: string
  archivePage: ReturnType<typeof useArchivePage>
}) {
  const reader = useBookmarkReader(id, true)

  if (reader.isPending) {
    return (
      <p className="grid flex-1 place-items-center p-6 font-mono text-xs text-ink-faint">
        reading the page…
      </p>
    )
  }

  if (reader.isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="notice bg-coral">
          {reader.error instanceof Error
            ? reader.error.message
            : 'could not read the page'}
        </p>
        <button
          type="button"
          className="btn bg-sky"
          disabled={archivePage.isPending}
          onClick={() => archivePage.mutate(id)}
        >
          {archivePage.isPending ? 'snapshotting…' : 'try a snapshot'}
        </button>
      </div>
    )
  }

  return (
    <>
      <iframe
        title={`preview of ${reader.data.title ?? reader.data.url}`}
        srcDoc={reader.data.html}
        sandbox=""
        referrerPolicy="no-referrer"
        className="min-h-0 w-full flex-1 bg-surface"
      />
      <footer className="rounded-b-[calc(var(--radius-xl)-2px)] border-t-2 border-line bg-surface-hover px-4 py-2">
        <span className="font-mono text-[11px] text-ink-faint">
          {reader.data.source === 'snapshot'
            ? 'rendered from your snapshot · scripts off'
            : reader.data.source === 'youtube'
              ? 'youtube transcript · scripts off'
              : 'fetched just now · scripts off'}
        </span>
      </footer>
    </>
  )
}
