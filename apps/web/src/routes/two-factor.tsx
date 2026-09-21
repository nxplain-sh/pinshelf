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
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-5 p-6">
      <div className="flex flex-col gap-2">
        <Logo />
        <h1 className="text-lg font-medium">two-factor</h1>
        <p className="font-mono text-xs text-ink-faint">
          {useBackupCode
            ? 'enter one of the backup codes you saved'
            : 'enter the code from your authenticator app'}
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          inputMode={useBackupCode ? 'text' : 'numeric'}
          required
          placeholder={useBackupCode ? 'backup code' : '123456'}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          aria-label="Verification code"
          className="field font-mono"
        />
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'checking…' : 'verify'}
        </button>
      </form>

      {error && <p className="font-mono text-xs text-danger">{error}</p>}

      <button
        type="button"
        className="self-start font-mono text-[11px] text-ink-faint underline underline-offset-4 hover:text-ink"
        onClick={() => {
          setUseBackupCode((current) => !current)
          setCode('')
          setError(null)
        }}
      >
        {useBackupCode ? 'use an authenticator code instead' : 'use a backup code'}
      </button>
    </main>
  )
}
