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
