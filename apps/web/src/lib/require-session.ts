import { createMiddleware } from '@tanstack/react-start'

/**
 * Server functions are reachable over HTTP at a predictable URL, and the CSRF
 * check only proves the caller is same-origin — which any script can fake.
 * Every data server function therefore authenticates explicitly. The only
 * public ones are `fetchSession` and `fetchSetupState`, which the login page
 * needs before a session exists.
 *
 * The session lookup is imported inside the server body so this module stays
 * importable from client code, where it only contributes the middleware stub.
 */
export const requireSession = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    const { requireSessionFromHeaders } = await import('~/lib/session-guard.server')

    const session = await requireSessionFromHeaders(getRequestHeaders())
    return next({ context: { session } })
  },
)
