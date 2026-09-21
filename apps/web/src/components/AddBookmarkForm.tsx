import { useState } from 'react'
import type { FormEvent } from 'react'
import { useCreateBookmark } from '~/lib/queries'

export function AddBookmarkForm({ initialUrl = '' }: { initialUrl?: string }) {
  const [url, setUrl] = useState(initialUrl)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const createBookmark = useCreateBookmark()

  function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    createBookmark.mutate(url, {
      onSuccess: (result) => {
        if (result.error || !result.bookmark) {
          setError(result.error ?? 'Failed to save bookmark')
          return
        }
        if (result.duplicate) {
          setMessage('already saved')
          return
        }
        setUrl('')
        setMessage(result.bookmark.title ? `saved "${result.bookmark.title}"` : 'saved')
      },
      onError: (cause) => {
        setError(cause instanceof Error ? cause.message : 'Failed to save bookmark')
      },
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="url"
          required
          placeholder="https://example.com/article"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="field flex-1 font-mono"
        />
        <button type="submit" disabled={createBookmark.isPending} className="btn-primary">
          {createBookmark.isPending ? 'saving…' : 'Save'}
        </button>
      </div>
      {error && <p className="font-mono text-xs text-danger">{error}</p>}
      {message && <p className="font-mono text-xs text-ink-faint">{message}</p>}
    </form>
  )
}
