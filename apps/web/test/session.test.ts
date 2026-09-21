import { beforeAll, describe, expect, it } from 'vitest'
import { auth } from '../src/lib/auth.server'
import { requireSessionFromHeaders } from '../src/lib/session-guard.server'

const email = 'guard@test.local'
const password = 'test-password-123'

beforeAll(async () => {
  await auth.api.signUpEmail({ body: { name: 'Owner', email, password } })
})

describe('server function guard', () => {
  it('rejects anonymous callers', async () => {
    await expect(requireSessionFromHeaders(new Headers())).rejects.toThrow(
      'Unauthorized: sign in first',
    )
  })

  it('rejects a bogus session cookie', async () => {
    await expect(
      requireSessionFromHeaders(
        new Headers({ cookie: 'better-auth.session_token=nope' }),
      ),
    ).rejects.toThrow('Unauthorized')
  })

  it('accepts a signed-in session', async () => {
    const { headers } = await auth.api.signInEmail({
      body: { email, password },
      returnHeaders: true,
    })
    const cookie = headers.get('set-cookie') ?? ''

    const session = await requireSessionFromHeaders(new Headers({ cookie }))
    expect(session.user.email).toBe(email)
  })
})
