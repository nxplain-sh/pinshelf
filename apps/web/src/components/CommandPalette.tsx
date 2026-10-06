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

// 'cmd/ctrl + k' → [cmd/ctrl] + [k]: a spaced joiner separates two keys.
function KeyCombo({ keys }: { keys: string }) {
  const match = keys.match(/^(.+) ([+/]) (.+)$/)
  if (!match) return <kbd className="kbd">{keys}</kbd>
  return (
    <>
      <kbd className="kbd">{match[1]}</kbd>
      <span>{match[2]}</span>
      <kbd className="kbd">{match[3]}</kbd>
    </>
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
    <div className="overlay flex items-start justify-center p-4 pt-[12vh]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={open ? 'command palette' : 'keyboard shortcuts'}
        className="dialog w-full max-w-lg overflow-hidden"
      >
        {help ? (
          <>
            <div className="panel-head rounded-t-none bg-sky py-3">
              <h2 className="text-xl leading-none font-bold tracking-tight">
                keyboard shortcuts
              </h2>
            </div>
            <ul className="flex flex-col px-4 py-2">
              {SHORTCUTS.map(([keys, description]) => (
                <li
                  key={keys}
                  className="flex items-center justify-between gap-4 border-b-2 border-line-soft py-2.5 last:border-0"
                >
                  <span className="flex items-center gap-1.5 font-mono text-[11px] text-ink-faint">
                    <KeyCombo keys={keys} />
                  </span>
                  <span className="text-right font-mono text-xs text-ink-muted">
                    {description}
                  </span>
                </li>
              ))}
            </ul>
          </>
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
              // The dialog is already the focused surface: no hard shadow here,
              // the thicker bottom rule is the focus cue instead.
              className="field w-full rounded-none border-0 border-b-2 bg-surface px-5 py-4 font-mono text-base focus:border-b-4 focus:pb-3.5 focus:shadow-none"
            />
            <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto p-2">
              {items.length === 0 && (
                <li className="px-3 py-3 font-mono text-xs text-ink-faint">
                  {results.isFetching ? 'searching…' : 'no matches'}
                </li>
              )}
              {items.map((item, position) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setIndex(position)}
                    onClick={() => openBookmark(item.id)}
                    className={`flex w-full flex-col items-start gap-0.5 rounded-md border-2 px-3 py-2 text-left ${
                      position === index
                        ? 'border-line bg-accent shadow-hard-xs'
                        : 'border-transparent'
                    }`}
                  >
                    <span className="w-full truncate text-sm font-semibold text-ink">
                      {item.title ?? hostFor(item.url)}
                    </span>
                    <span
                      className={`font-mono text-[11px] ${
                        position === index ? 'text-ink-muted' : 'text-ink-faint'
                      }`}
                    >
                      {hostFor(item.url)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t-2 border-line bg-surface-hover px-4 py-2.5 font-mono text-[11px] text-ink-muted">
              <span className="flex items-center gap-1.5">
                <kbd className="kbd">enter</kbd> opens
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="kbd">esc</kbd> closes
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="kbd">?</kbd> for all shortcuts
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
