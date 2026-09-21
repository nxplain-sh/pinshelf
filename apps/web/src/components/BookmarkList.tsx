import { Link } from '@tanstack/react-router'
import { Logo } from '~/components/Logo'
import { useEffect, useRef, useState } from 'react'
import type { BookmarkListItem } from '~/lib/bookmarks.types'
import {
  useArchiveBookmark,
  useDeleteBookmark,
  useRestoreBookmark,
  useTrashBookmark,
} from '~/lib/queries'

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

  if (bookmarks.length === 0) {
    return (
      <p className="border border-dashed border-line py-10 text-center font-mono text-xs text-ink-faint">
        nothing here yet
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      {selectable && onToggleAll && (
        <div className="flex items-center gap-2 px-1">
          <input
            ref={selectAllRef}
            type="checkbox"
            checked={allSelected}
            onChange={() => onToggleAll(bookmarks.map((bookmark) => bookmark.id))}
            className="checkbox h-3.5 w-3.5 shrink-0"
            aria-label="Select all visible bookmarks"
          />
          <span className="font-mono text-[11px] text-ink-faint">
            {allSelected ? 'clear selection' : `select all ${bookmarks.length}`}
          </span>
        </div>
      )}
      <ul className="flex flex-col gap-1.5">
        {bookmarks.map((bookmark) => {
          const favicon = faviconFor(bookmark)
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
              className={`group flex gap-3 rounded-md border bg-surface p-3 transition-colors ${
                overId === bookmark.id || activeId === bookmark.id
                  ? 'border-accent'
                  : 'border-line hover:border-line-strong'
              } ${dragId === bookmark.id ? 'opacity-50' : ''}`}
            >
              {draggable && (
                <span
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 cursor-grab font-mono text-xs text-ink-faint select-none"
                >
                  ⠿
                </span>
              )}
              {selectable && (
                <input
                  type="checkbox"
                  checked={selected?.has(bookmark.id) ?? false}
                  onChange={() => onToggle?.(bookmark.id)}
                  className="checkbox mt-1 h-3.5 w-3.5 shrink-0"
                  aria-label={`Select ${bookmark.title || bookmark.url}`}
                />
              )}
              {favicon ? (
                <img
                  src={favicon}
                  alt=""
                  width={16}
                  height={16}
                  referrerPolicy="no-referrer"
                  className="mt-0.5 h-4 w-4 shrink-0 opacity-80"
                />
              ) : (
                // No favicon: the mark at ink-faint, never at full brass, so a
                // list of them does not light up (docs/design.md rule 9).
                <Logo size={16} mono className="mt-0.5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <Link
                    to="/bookmarks/$id"
                    params={{ id: bookmark.id }}
                    className="truncate text-sm font-medium text-ink underline-offset-4 hover:underline"
                  >
                    {bookmark.title || bookmark.url}
                  </Link>
                  <span className="shrink-0 font-mono text-[11px] text-ink-faint">
                    {hostFor(bookmark.url)}
                  </span>
                  {bookmark.collectionName && (
                    <span className="shrink-0 font-mono text-[11px] text-ink-muted">
                      /{bookmark.collectionName}
                    </span>
                  )}
                </div>
                {bookmark.description && (
                  <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-muted">
                    {bookmark.description}
                  </p>
                )}
                {bookmark.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {bookmark.tags.slice(0, 6).map((tag) => (
                      <span key={tag} className="chip">
                        {tag}
                      </span>
                    ))}
                    {bookmark.tags.length > 6 && (
                      <span className="font-mono text-[11px] text-ink-faint">
                        +{bookmark.tags.length - 6}
                      </span>
                    )}
                  </div>
                )}
                {bookmark.metadataStatus === 'failed' && (
                  <p className="mt-1 font-mono text-[11px] text-warn">
                    metadata fetch failed
                  </p>
                )}
                {bookmark.linkStatus === 'broken' && (
                  <p className="mt-1 font-mono text-[11px] text-warn">
                    link looks broken
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-start gap-1 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100">
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
                      className="btn"
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
                      className="btn"
                      onClick={() => restoreBookmark.mutate(bookmark.id)}
                    >
                      restore
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => deleteBookmark.mutate(bookmark.id)}
                    >
                      delete
                    </button>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
