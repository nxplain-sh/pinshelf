import { auth } from '~/lib/auth.server'

/**
 * Resolves the signed-in user from request headers, throwing when there is no
 * session. Kept free of framework imports so it can be unit tested directly.
 */
export async function requireSessionFromHeaders(headers: Headers) {
  const session = await auth.api.getSession({ headers })
  if (!session) {
    throw new Error('Unauthorized: sign in first')
  }
  return session
}
