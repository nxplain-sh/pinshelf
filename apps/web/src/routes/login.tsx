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
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(70%_45%_at_50%_0%,rgba(201,162,39,0.07),transparent)] p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <h1 className="sr-only">pinshelf</h1>
        <img
          src="/social-card.png"
          alt="pinshelf — pin it, shelf it, find it"
          width={1200}
          height={630}
          className="w-full rounded-lg border border-line"
        />
        <div className="flex flex-col gap-1">
          <p className="font-mono text-xs text-ink-faint">
            {needsSetup
              ? 'first run — create the owner account'
              : 'sign in to your instance'}
          </p>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-2">
          {needsSetup && (
            <input
              type="text"
              required
              placeholder="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="field"
            />
          )}
          <input
            type="email"
            required
            placeholder="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="field"
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field"
          />

          {error && <p className="font-mono text-xs text-danger">{error}</p>}

          <button type="submit" disabled={pending} className="btn-primary mt-1">
            {pending ? 'working…' : needsSetup ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="font-mono text-[11px] text-ink-faint">
          self-hosted, MIT-licensed software ·{' '}
          <a
            href="https://github.com/nxplain-sh/pinshelf/blob/main/TERMS_OF_SERVICE.md"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 transition-colors hover:text-ink"
          >
            terms
          </a>{' '}
          · v{version}
        </p>
      </div>
    </main>
  )
}
