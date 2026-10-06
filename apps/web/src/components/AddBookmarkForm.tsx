import { useState } from 'react'
import type { FormEvent } from 'react'
import { useCreateBookmark } from '~/lib/queries'

export function AddBookmarkForm({
  initialUrl = '',
  onAccent = false,
}: {
  initialUrl?: string
  /** Set when the form sits on an accent fill: the yellow save button turns paper. */
  onAccent?: boolean
}) {
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
    // Messages are toned notices rather than coloured text, so they stay
    // readable on whatever the caller puts behind the form.
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          type="url"
          required
          placeholder="https://example.com/article"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="field min-w-0 flex-1 py-2.5 font-mono sm:text-base"
        />
        <button
          type="submit"
          disabled={createBookmark.isPending}
          className={onAccent ? 'btn-primary bg-surface px-5' : 'btn-primary px-5'}
        >
          {createBookmark.isPending ? 'saving…' : 'Save'}
        </button>
      </div>
      {error && <p className="notice self-start bg-coral">{error}</p>}
      {message && <p className="notice self-start bg-mint">{message}</p>}
    </form>
  )
}
