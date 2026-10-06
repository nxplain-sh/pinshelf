import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Logo } from '~/components/Logo'
import { authClient } from '~/lib/auth'

export const Route = createFileRoute('/two-factor')({
  component: TwoFactorPage,
})

function TwoFactorPage() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setPending(true)

    const result = useBackupCode
      ? await authClient.twoFactor.verifyBackupCode({ code })
      : await authClient.twoFactor.verifyTotp({ code, trustDevice: true })

    setPending(false)
    if (result.error) {
      setError(result.error.message ?? 'That code did not work')
      return
    }
    await navigate({ to: '/' })
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:p-8">
      <div className="panel flex w-full max-w-sm flex-col overflow-hidden">
        <div className="panel-head justify-start gap-3 bg-mint py-3">
          <Logo size={40} />
          <h1 className="text-2xl leading-none font-bold tracking-tight">two-factor</h1>
        </div>

        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <p className="font-mono text-xs leading-relaxed text-ink-muted">
            {useBackupCode
              ? 'enter one of the backup codes you saved'
              : 'enter the code from your authenticator app'}
          </p>

          <form onSubmit={submit} className="flex flex-col gap-4">
            <input
              inputMode={useBackupCode ? 'text' : 'numeric'}
              required
              placeholder={useBackupCode ? 'backup code' : '123456'}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              aria-label="Verification code"
              className={`field py-3 text-center font-mono text-xl ${
                useBackupCode ? 'tracking-wide' : 'tracking-[0.3em]'
              }`}
            />
            <button
              type="submit"
              className="btn-primary w-full py-3 text-base"
              disabled={pending}
            >
              {pending ? 'checking…' : 'verify'}
            </button>
          </form>

          {error && <p className="notice bg-coral">{error}</p>}

          <button
            type="button"
            className="link self-start font-mono text-xs"
            onClick={() => {
              setUseBackupCode((current) => !current)
              setCode('')
              setError(null)
            }}
          >
            {useBackupCode ? 'use an authenticator code instead' : 'use a backup code'}
          </button>
        </div>
      </div>
    </main>
  )
}
