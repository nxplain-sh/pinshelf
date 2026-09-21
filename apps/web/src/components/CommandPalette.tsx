import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { listBookmarks } from '~/lib/bookmarks'
import { queryKeys } from '~/lib/queries'

export const SHORTCUTS: [string, string][] = [
  ['cmd/ctrl + k', 'command palette'],
  ['j / k', 'move down / up the list'],
  ['enter', 'open the highlighted row'],
  ['x', 'select the highlighted row'],
  ['t', 'trash the highlighted row'],
  ['a', 'archive the highlighted row'],
  ['?', 'this list'],
  ['esc', 'close'],
]

function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element) return false
  return (
    element.tagName === 'INPUT' ||
    element.tagName === 'TEXTAREA' ||
    element.tagName === 'SELECT' ||
    element.isContentEditable
  )
}

function hostFor(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [help, setHelp] = useState(false)
  const [term, setTerm] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const results = useQuery({
    queryKey: [...queryKeys.bookmarks.all, 'palette', term],
    queryFn: () => listBookmarks({ data: { status: 'active', q: term || undefined } }),
    enabled: open,
  })

  const items = (results.data ?? []).slice(0, 8)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setHelp(false)
        setOpen((current) => !current)
        return
      }
      if (event.key === 'Escape') {
        setOpen(false)
        setHelp(false)
        return
      }
      if (event.key === '?' && !isTyping(event.target)) {
        event.preventDefault()
        setOpen(false)
        setHelp((current) => !current)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) {
      setTerm('')
      setIndex(0)
      inputRef.current?.focus()
    }
  }, [open])

  function openBookmark(id: string) {
    setOpen(false)
    void navigate({ to: '/bookmarks/$id', params: { id } })
  }

  function onInputKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setIndex((current) => Math.min(current + 1, items.length - 1))
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setIndex((current) => Math.max(current - 1, 0))
    }
    if (event.key === 'Enter' && items[index]) {
      event.preventDefault()
      openBookmark(items[index].id)
    }
  }

  if (!open && !help) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-canvas/80 p-4 pt-[12vh]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={open ? 'command palette' : 'keyboard shortcuts'}
        className="w-full max-w-lg rounded-lg border border-line bg-surface"
      >
        {help ? (
          <div className="flex flex-col gap-2 p-4">
            <h2 className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">
              keyboard shortcuts
            </h2>
            {SHORTCUTS.map(([keys, description]) => (
              <div key={keys} className="flex items-baseline justify-between gap-4">
                <span className="font-mono text-xs text-ink">{keys}</span>
                <span className="font-mono text-[11px] text-ink-muted">
                  {description}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <>
            <input
              ref={inputRef}
              value={term}
              onChange={(event) => {
                setTerm(event.target.value)
                setIndex(0)
              }}
              onKeyDown={onInputKey}
              placeholder="search bookmarks…"
              aria-label="search bookmarks"
              className="field w-full rounded-b-none border-0 border-b border-line font-mono"
            />
            <ul className="max-h-80 overflow-y-auto p-2">
              {items.length === 0 && (
                <li className="px-2 py-3 font-mono text-xs text-ink-faint">
                  {results.isFetching ? 'searching…' : 'no matches'}
                </li>
              )}
              {items.map((item, position) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setIndex(position)}
                    onClick={() => openBookmark(item.id)}
                    className={`flex w-full flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left ${
                      position === index ? 'border-accent' : 'border-transparent'
                    }`}
                  >
                    <span className="text-sm text-ink">
                      {item.title ?? hostFor(item.url)}
                    </span>
                    <span className="font-mono text-[11px] text-ink-faint">
                      {hostFor(item.url)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="border-t border-line px-4 py-2 font-mono text-[11px] text-ink-faint">
              enter opens · esc closes · ? for all shortcuts
            </p>
          </>
        )}
      </div>
    </div>
  )
}
