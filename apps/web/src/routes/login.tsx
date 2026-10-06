import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { version } from '../../package.json'
import { authClient } from '~/lib/auth'
import { fetchSession, fetchSetupState } from '~/lib/session'

export const Route = createFileRoute('/login')({
  loader: async () => {
    const session = await fetchSession()
    if (session) {
      throw redirect({ to: '/' })
    }
    return fetchSetupState()
  },
  component: LoginPage,
})

function LoginPage() {
  const { needsSetup } = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)

    const result = needsSetup
      ? await authClient.signUp.email({ name, email, password })
      : await authClient.signIn.email({ email, password })

    if (result.error) {
      setError(result.error.message ?? 'Something went wrong')
      setPending(false)
      return
    }

    await router.invalidate()
    await navigate({ to: '/' })
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:p-8">
      <h1 className="sr-only">pinshelf</h1>
      <div className="grid w-full max-w-sm items-center gap-10 md:max-w-5xl md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] md:gap-14">
        {/* The poster: the social card pinned to the board, a little crooked on phones. */}
        <div className="relative -rotate-1 md:rotate-0">
          <div
            aria-hidden
            className="absolute inset-0 translate-x-2 translate-y-3 rotate-3 rounded-xl border-2 border-line bg-pink md:translate-x-4 md:translate-y-4"
          />
          <img
            src="/social-card.png"
            alt="pinshelf — pin it, shelf it, find it"
            width={1200}
            height={630}
            className="relative w-full rounded-xl border-2 border-line bg-ink shadow-hard-xl"
          />
          <span className="sticker absolute -top-3 -right-2 rotate-3 normal-case">
            v{version}
          </span>
        </div>

        <div className="flex flex-col gap-5">
          <div className="panel flex flex-col gap-6 p-5 sm:p-7">
            <div className="flex flex-col items-start gap-2">
              {needsSetup && <span className="sticker">first run</span>}
              <h2 className="page-title">
                {needsSetup ? 'create the owner account' : 'sign in'}
              </h2>
              {!needsSetup && (
                <p className="font-mono text-xs text-ink-muted">to your instance</p>
              )}
            </div>

            <form onSubmit={submit} className="flex flex-col gap-4">
              {needsSetup && (
                <label className="flex flex-col gap-1.5">
                  <span className="label">name</span>
                  <input
                    type="text"
                    required
                    placeholder="your name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="field"
                  />
                </label>
              )}
              <label className="flex flex-col gap-1.5">
                <span className="label">email</span>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="field"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="label">password</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder={needsSetup ? '8+ characters' : undefined}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="field"
                />
              </label>

              {error && <p className="notice bg-coral">{error}</p>}

              <button
                type="submit"
                disabled={pending}
                className="btn-primary mt-1 w-full py-3 text-base"
              >
                {pending ? 'working…' : needsSetup ? 'Create account' : 'Sign in'}
              </button>
            </form>
          </div>

          <p className="text-center font-mono text-[11px] text-ink-muted">
            self-hosted, MIT-licensed software ·{' '}
            <a
              href="https://github.com/nxplain-sh/pinshelf/blob/main/TERMS_OF_SERVICE.md"
              target="_blank"
              rel="noreferrer"
              className="link"
            >
              terms
            </a>
          </p>
        </div>
      </div>
    </main>
  )
}
