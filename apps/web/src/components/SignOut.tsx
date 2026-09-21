import { useState } from 'react'
import { signOut } from '~/lib/session'

/**
 * Revokes the session on the server before navigating. The old client-only
 * version could fail its request, leave the session alive, and land back on
 * the home page with no explanation.
 */
export function SignOut() {
  const [failed, setFailed] = useState(false)

  async function run() {
    setFailed(false)
    try {
      await signOut()
    } catch {
      setFailed(true)
      return
    }
    window.location.assign('/login')
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        className="font-mono text-xs text-ink-muted transition-colors hover:text-ink"
        onClick={run}
      >
        sign out
      </button>
      {failed && <span className="font-mono text-xs text-danger">failed — retry</span>}
    </span>
  )
}
