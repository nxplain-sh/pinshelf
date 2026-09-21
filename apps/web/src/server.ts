import handler from '@tanstack/react-start/server-entry'
import { runScheduledBackup } from '~/lib/backup.server'
import { retryFailedMetadata } from '~/lib/bookmarks.server'
import { checkStaleLinks } from '~/lib/links.server'
import { pruneStaleTwoFactor } from '~/lib/two-factor.server'

/**
 * Headers every app response carries. The strict CSP the static site uses is
 * not repeated here: TanStack Start hydrates with inline scripts, so the app
 * would need hashes it cannot know at build time. `frame-ancestors` still
 * prevents framing, which is the part that matters for a logged-in app.
 */
const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': "frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=(), payment=()',
}

/**
 * Custom Worker entry. TanStack Start handles fetch; the daily cron trigger
 * writes a JSON snapshot of the library to R2 and prunes old ones.
 */
export default {
  async fetch(request: Request) {
    const response = await handler.fetch(request)
    const headers = new Headers(response.headers)

    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      headers.set(name, value)
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  },

  async scheduled(_event: ScheduledController, _env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      runScheduledBackup().then(
        (backup) => console.log(`backup written: ${backup.key} (${backup.size} bytes)`),
        (error) => console.error('backup failed', error),
      ),
    )

    // Retry metadata that failed and re-check links that have gone stale; both
    // are bounded so a slow library cannot run past the cron window.
    ctx.waitUntil(
      retryFailedMetadata().then(
        (count) => console.log(`metadata retried: ${count}`),
        (error) => console.error('metadata retry failed', error),
      ),
    )

    ctx.waitUntil(
      checkStaleLinks().then(
        (count) => console.log(`links checked: ${count}`),
        (error) => console.error('link check failed', error),
      ),
    )

    // Abandoned two-factor enrollments do not need to live forever.
    ctx.waitUntil(
      pruneStaleTwoFactor().then(
        (count) => console.log(`stale two-factor setups pruned: ${count}`),
        (error) => console.error('two-factor prune failed', error),
      ),
    )
  },
}
