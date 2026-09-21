import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { db } from '~/db/index.server'
import { user } from '~/db/schema'
import { auth } from '~/lib/auth.server'

export const fetchSession = createServerFn({ method: 'GET' }).handler(async () => {
  return auth.api.getSession({ headers: getRequestHeaders() })
})

export const fetchSetupState = createServerFn({ method: 'GET' }).handler(async () => {
  const [existing] = await db.select({ id: user.id }).from(user).limit(1)
  return { needsSetup: !existing }
})

/**
 * Signs out on the server, so the session row is gone even if the browser
 * ignores the cookie-clearing response. Without this a failed client request
 * left the session alive and /login bounced the user straight back home.
 */
export const signOut = createServerFn({ method: 'POST' }).handler(async () => {
  await auth.api.signOut({ headers: getRequestHeaders() })
})
