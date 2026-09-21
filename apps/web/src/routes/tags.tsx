import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { SignOut } from '~/components/SignOut'
import { queryKeys, useMergeTag, useRenameTag } from '~/lib/queries'
import { fetchSession } from '~/lib/session'
import { listTags } from '~/lib/taxonomy'

export const Route = createFileRoute('/tags')({
  beforeLoad: async () => {
    const session = await fetchSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    return { session }
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: queryKeys.tags,
      queryFn: () => listTags(),
    })
  },
  component: TagsPage,
})

function TagsPage() {
  const { data: tags } = useSuspenseQuery({
    queryKey: queryKeys.tags,
    queryFn: () => listTags(),
  })
  const renameTag = useRenameTag()
  const mergeTag = useMergeTag()
  const [tagNames, setTagNames] = useState<Record<string, string>>({})
  const [mergeFrom, setMergeFrom] = useState('')
  const [mergeInto, setMergeInto] = useState('')
  const [message, setMessage] = useState<string | null>(null)

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
          <span className="font-mono text-xs text-ink-faint">tags</span>
          <SignOut />
        </div>
      </header>

      <ul className="flex flex-col gap-2">
        {tags.map((tag) => (
          <li key={tag.id} className="flex items-center gap-2">
            <input
              value={tagNames[tag.id] ?? tag.name}
              onChange={(event) =>
                setTagNames((current) => ({ ...current, [tag.id]: event.target.value }))
              }
              aria-label={`Rename ${tag.name}`}
              className="field flex-1 font-mono"
            />
            <button
              type="button"
              className="btn"
              disabled={
                renameTag.isPending || (tagNames[tag.id] ?? tag.name).trim() === tag.name
              }
              onClick={() => {
                setMessage(null)
                renameTag.mutate(
                  { id: tag.id, name: tagNames[tag.id] ?? tag.name },
                  {
                    onSuccess: (result) => {
                      setTagNames((current) => {
                        const next = { ...current }
                        delete next[tag.id]
                        return next
                      })
                      setMessage(result.error ?? `renamed to "${result.tag?.name}"`)
                    },
                  },
                )
              }}
            >
              rename
            </button>
          </li>
        ))}
        {tags.length === 0 && (
          <li className="font-mono text-[11px] text-ink-faint">no tags yet</li>
        )}
      </ul>

      {tags.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
          <span className="label">merge</span>
          <select
            value={mergeFrom}
            onChange={(event) => setMergeFrom(event.target.value)}
            aria-label="Merge this tag"
            className="field font-mono"
          >
            <option value="">this…</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
          <span className="font-mono text-xs text-ink-faint">into</span>
          <select
            value={mergeInto}
            onChange={(event) => setMergeInto(event.target.value)}
            aria-label="Into this tag"
            className="field font-mono"
          >
            <option value="">…this</option>
            {tags
              .filter((tag) => tag.id !== mergeFrom)
              .map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
          </select>
          <button
            type="button"
            className="btn"
            disabled={mergeTag.isPending || !mergeFrom || !mergeInto}
            onClick={() => {
              setMessage(null)
              mergeTag.mutate(
                { fromId: mergeFrom, intoId: mergeInto },
                {
                  onSuccess: (result) => {
                    setMergeFrom('')
                    setMergeInto('')
                    setMessage(result.error ?? `merged ${result.moved} bookmarks`)
                  },
                },
              )
            }}
          >
            merge
          </button>
          <span className="font-mono text-[11px] text-ink-faint">
            the toolbox can suggest merges for near-duplicate tags
          </span>
        </div>
      )}

      {message && <p className="font-mono text-xs text-ink-muted">{message}</p>}
    </main>
  )
}
