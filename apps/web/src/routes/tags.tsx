import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { AppHeader, PageHeading } from '~/components/AppHeader'
import { queryKeys, useMergeTag, useRenameTag } from '~/lib/queries'
import { fetchSession } from '~/lib/session'
import { tagTone } from '~/lib/tag-tone'
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
    <main className="page">
      <AppHeader />
      <PageHeading
        title="tags"
        note={`${tags.length} ${tags.length === 1 ? 'tag' : 'tags'} · rename in place, merge the near-duplicates`}
      />

      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_17rem]">
        <ul className="grid gap-2.5 lg:grid-cols-2">
          {tags.map((tag) => (
            <li key={tag.id} className="tile flex items-center gap-2 p-3">
              {/* The tag's own fill, so it reads the same as everywhere else. */}
              <span
                className={`size-5 shrink-0 rounded-full border-2 border-line ${tagTone(tag.name)}`}
              />
              <input
                value={tagNames[tag.id] ?? tag.name}
                onChange={(event) =>
                  setTagNames((current) => ({ ...current, [tag.id]: event.target.value }))
                }
                aria-label={`Rename ${tag.name}`}
                className="field min-w-0 flex-1 px-2 py-1 font-mono"
              />
              <button
                type="button"
                className="btn"
                disabled={
                  renameTag.isPending ||
                  (tagNames[tag.id] ?? tag.name).trim() === tag.name
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
          {tags.length === 0 && <li className="empty lg:col-span-2">no tags yet</li>}
        </ul>

        {/* Sticky beside the list on wide screens, so merge and the result line
            stay in view however long the list gets. */}
        <aside className="flex flex-col gap-3 md:sticky md:top-24">
          {tags.length > 1 && (
            <section className="panel">
              <div className="panel-head bg-pink">
                <h2 className="section-title">Merge</h2>
              </div>
              <div className="flex flex-col gap-3 p-4">
                <select
                  value={mergeFrom}
                  onChange={(event) => setMergeFrom(event.target.value)}
                  aria-label="Merge this tag"
                  className="field w-full font-mono"
                >
                  <option value="">this…</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
                <span className="label">into</span>
                <select
                  value={mergeInto}
                  onChange={(event) => setMergeInto(event.target.value)}
                  aria-label="Into this tag"
                  className="field w-full font-mono"
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
                  className="btn-primary mt-1"
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
                <p className="font-mono text-[11px] text-ink-faint">
                  the toolbox can suggest merges for near-duplicate tags
                </p>
              </div>
            </section>
          )}

          {message && <p className="font-mono text-xs text-ink-muted">{message}</p>}
        </aside>
      </div>
    </main>
  )
}
