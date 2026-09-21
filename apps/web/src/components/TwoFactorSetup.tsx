import { useEffect, useMemo, useRef, useState } from 'react'
import { renderSVG } from 'uqr'
import { authClient } from '~/lib/auth'
import { discardTwoFactorSetup } from '~/lib/library'

// How long a generated secret stays valid on screen. An unverified secret can
// never sign anyone in, so expiry is about not leaving a half-finished setup
// lying around: when the countdown ends the pending secret is deleted and a new
// one has to be generated.
const SETUP_TTL_MS = 10 * 60 * 1000
const WARN_UNDER_SECONDS = 60

type Setup = { totpURI: string; backupCodes: string[] }

function formatRemaining(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

function Codes({
  codes,
  label = 'backup codes — each works once',
}: {
  codes: string[]
  label?: string
}) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <code className="font-mono text-[11px] break-all text-ink-muted">
          {codes.join(' · ')}
        </code>
        <button
          type="button"
          className="btn shrink-0"
          onClick={async () => {
            await navigator.clipboard.writeText(codes.join('\n')).catch(() => undefined)
            setCopied(true)
          }}
        >
          {copied ? 'copied' : 'copy codes'}
        </button>
      </div>
    </div>
  )
}

export function TwoFactorSetup({
  enabled,
  onMessage,
  onChanged,
}: {
  enabled: boolean
  onMessage: (message: string, tone?: 'info' | 'warn' | 'error') => void
  /** Called when the account's two-factor state flips, so the page can refetch. */
  onChanged: () => void
}) {
  const [setup, setSetup] = useState<Setup | null>(null)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [freshCodes, setFreshCodes] = useState<string[] | null>(null)
  const expiredHandled = useRef(false)

  const secondsLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 0
  const expiring = expiresAt !== null && secondsLeft <= WARN_UNDER_SECONDS

  useEffect(() => {
    if (!expiresAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [expiresAt])

  useEffect(() => {
    if (!setup || !expiresAt || secondsLeft > 0 || expiredHandled.current) return
    expiredHandled.current = true
    void discardTwoFactorSetup()
      .then(() => {
        setSetup(null)
        setExpiresAt(null)
        setConfirming(false)
        onMessage('the setup code expired — generate a new one', 'warn')
      })
      .catch(() => onMessage('the setup code expired'))
  }, [secondsLeft, setup, expiresAt, onMessage])

  const qrSrc = useMemo(() => {
    if (!setup) return ''
    const svg = renderSVG(setup.totpURI, {
      // Four modules of quiet zone, so a phone camera locks on reliably.
      border: 4,
      pixelSize: 4,
      whiteColor: '#f2ece2',
      blackColor: '#131110',
    })
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  }, [setup])

  async function generate() {
    setPending(true)
    const result = await authClient.twoFactor.enable({ password })
    setPending(false)
    setPassword('')
    if (result.error) {
      onMessage(result.error.message ?? 'could not generate a code', 'error')
      return
    }
    if (result.data.method !== 'totp') {
      onMessage('the server did not return a TOTP secret', 'error')
      return
    }
    expiredHandled.current = false
    setSetup({ totpURI: result.data.totpURI, backupCodes: result.data.backupCodes })
    setExpiresAt(Date.now() + SETUP_TTL_MS)
    setNow(Date.now())
    setCode('')
    setConfirming(false)
  }

  async function verify() {
    setPending(true)
    const result = await authClient.twoFactor.verifyTotp({ code })
    setPending(false)
    if (result.error) {
      // Back to the code input so the next attempt is one keystroke away.
      setConfirming(false)
      onMessage(result.error.message ?? 'that code did not work', 'error')
      return
    }
    setSetup(null)
    setExpiresAt(null)
    setCode('')
    setConfirming(false)
    onMessage('two-factor is on')
    onChanged()
  }

  async function regenerateCodes() {
    setPending(true)
    const result = await authClient.twoFactor.generateBackupCodes({ password })
    setPending(false)
    setPassword('')
    if (result.error) {
      onMessage(result.error.message ?? 'could not generate new backup codes', 'error')
      return
    }
    setFreshCodes(result.data.backupCodes)
    onMessage('new backup codes generated — the old ones no longer work')
  }

  if (enabled) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="password"
            placeholder="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-label="Password"
            className="field font-mono"
          />
          <button
            type="button"
            className="btn"
            disabled={!password || pending}
            onClick={() => void regenerateCodes()}
          >
            {pending ? 'working…' : 'new backup codes'}
          </button>
          <button
            type="button"
            className="btn"
            disabled={!password || pending}
            onClick={async () => {
              setPending(true)
              const result = await authClient.twoFactor.disable({ password })
              setPending(false)
              setPassword('')
              setFreshCodes(null)
              onMessage(
                result.error ? (result.error.message ?? 'failed') : 'two-factor is off',
                result.error ? 'error' : 'info',
              )
              if (!result.error) onChanged()
            }}
          >
            disable
          </button>
        </div>

        {freshCodes && (
          <div className="panel flex flex-col gap-2 p-3">
            <Codes codes={freshCodes} label="new backup codes — save them now" />
            <button
              type="button"
              className="btn self-start"
              onClick={() => setFreshCodes(null)}
            >
              done
            </button>
          </div>
        )}
      </div>
    )
  }

  if (!setup) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="password"
            placeholder="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-label="Password"
            className="field font-mono"
          />
          <button
            type="button"
            className="btn-primary"
            disabled={!password || pending}
            onClick={() => void generate()}
          >
            {pending ? 'generating…' : 'generate QR code'}
          </button>
        </div>
        <p className="font-mono text-[11px] text-ink-faint">
          nothing changes until you scan the code and verify one from your authenticator
        </p>
      </div>
    )
  }

  return (
    <div className="panel flex flex-col gap-3 p-3">
      <div className="flex flex-wrap items-start gap-4">
        <div className="shrink-0 rounded-md bg-ink p-2">
          <img src={qrSrc} width={160} height={160} alt="TOTP QR code" />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <span className={expiring ? 'label text-warn' : 'label'}>
            scan with your authenticator · expires in {formatRemaining(secondsLeft)}
          </span>
          <span className="label">can't scan? enter this instead</span>
          <code className="overflow-x-auto font-mono text-[11px] break-all text-ink-muted">
            {setup.totpURI}
          </code>
          <Codes codes={setup.backupCodes} />
        </div>
      </div>

      {confirming ? (
        <div className="flex flex-col gap-2 rounded-md border border-line-strong p-3">
          <p className="font-mono text-[11px] text-warn">
            Turning on two-factor means every sign-in needs a code from your
            authenticator. If you lose that device and these backup codes, you cannot sign
            in — there is no recovery account and no support desk. Save the codes first.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={pending}
              onClick={() => void verify()}
            >
              {pending ? 'checking…' : 'yes, enable two-factor'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            aria-label="Verification code"
            className="field font-mono"
          />
          <button
            type="button"
            className="btn-primary"
            disabled={!code || pending}
            onClick={() => setConfirming(true)}
          >
            verify and enable
          </button>
          <button
            type="button"
            className="btn"
            disabled={pending}
            onClick={() => {
              setSetup(null)
              setExpiresAt(null)
              setConfirming(false)
              void discardTwoFactorSetup().then(() =>
                onMessage('pending code discarded — generate a new one'),
              )
            }}
          >
            discard
          </button>
        </div>
      )}
    </div>
  )
}
