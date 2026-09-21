import { useState } from 'react'
import type { FormEvent } from 'react'
import { useBulkUpdate } from '~/lib/queries'

type BulkPayload = {
  ids: string[]
  addTags?: string[]
  removeTags?: string[]
  collectionId?: string | null
  status?: 'active' | 'trashed'
}

export function BulkActions({
  ids,
  urls,
  collections,
  onClear,
}: {
  ids: string[]
  urls: string[]
  collections: { id: string; name: string }[]
  onClear: () => void
}) {
  const bulkUpdate = useBulkUpdate()
  const [tagInput, setTagInput] = useState('')
  const [removeInput, setRemoveInput] = useState('')
  const [collectionId, setCollectionId] = useState('')
  const [error, setError] = useState<string | null>(null)

  function run(payload: BulkPayload) {
    setError(null)
    bulkUpdate.mutate(payload, {
      onSuccess: onClear,
      onError: (cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Bulk update failed'),
    })
  }

  function submitTags(event: FormEvent) {
    event.preventDefault()
    const tags = tagInput.split(',')
    if (tags.some((tag) => tag.trim())) {
      run({ ids, addTags: tags })
    }
  }

  function openAll() {
    setError(null)
    if (urls.length > 5 && !confirm(`Open ${urls.length} tabs?`)) return
    const blocked = urls.filter((url) => !window.open(url, '_blank', 'noopener'))
    if (blocked.length > 0) {
      setError(
        `${blocked.length} of ${urls.length} tabs blocked — allow popups for this site`,
      )
    }
  }

  return (
    <div className="panel flex flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-ink-muted">{ids.length} selected</span>
        <button type="button" onClick={onClear} className="btn">
          clear
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={urls.length === 0}
          className="btn"
          onClick={openAll}
        >
          open {urls.length}
        </button>

        <form onSubmit={submitTags} className="flex items-center gap-1">
          <input
            type="text"
            placeholder="tag1, tag2"
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            className="field w-36 px-2 py-1 font-mono text-xs"
          />
          <button type="submit" disabled={bulkUpdate.isPending} className="btn">
            add tags
          </button>
        </form>

        <div className="flex items-center gap-1">
          <input
            type="text"
            placeholder="tag1, tag2"
            value={removeInput}
            onChange={(event) => setRemoveInput(event.target.value)}
            className="field w-36 px-2 py-1 font-mono text-xs"
          />
          <button
            type="button"
            disabled={bulkUpdate.isPending}
            className="btn"
            onClick={() => {
              const tags = removeInput.split(',')
              if (tags.some((tag) => tag.trim())) {
                run({ ids, removeTags: tags })
              }
            }}
          >
            remove tags
          </button>
        </div>

        <div className="flex items-center gap-1">
          <select
            value={collectionId}
            onChange={(event) => setCollectionId(event.target.value)}
            className="field px-2 py-1 font-mono text-xs"
          >
            <option value="">move to…</option>
            <option value="__none__">no collection</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={bulkUpdate.isPending || !collectionId}
            className="btn"
            onClick={() => {
              run({
                ids,
                collectionId: collectionId === '__none__' ? null : collectionId,
              })
            }}
          >
            move
          </button>
        </div>

        <button
          type="button"
          disabled={bulkUpdate.isPending}
          className="btn"
          onClick={() => run({ ids, status: 'trashed' })}
        >
          trash
        </button>
      </div>

      {error && <p className="font-mono text-xs text-danger">{error}</p>}
    </div>
  )
}
