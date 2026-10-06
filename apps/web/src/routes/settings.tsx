import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { authClient } from '~/lib/auth'
import { AppHeader, PageHeading } from '~/components/AppHeader'
import { TwoFactorSetup } from '~/components/TwoFactorSetup'
import { exportJson, exportMarkdown, exportNetscape } from '~/lib/import-export'
import { getAiSettings } from '~/lib/ai'
import { getBackups } from '~/lib/backup'
import { autoArchive as autoArchiveSetting } from '~/lib/library'
import {
  queryKeys,
  useClearAiKey,
  useCreateApiToken,
  useImportBookmarks,
  useRevokeApiToken,
  useBackupNow,
  useSaveAutoArchive,
  useRemoveBackup,
  useRestoreBackup,
  useSaveAiSettings,
  useTestAiConnection,
  useUpdateBackupRetention,
} from '~/lib/queries'
import { fetchSession } from '~/lib/session'
import { listApiTokens } from '~/lib/tokens'

export const Route = createFileRoute('/settings')({
  beforeLoad: async () => {
    const session = await fetchSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    return { session }
  },
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData({
        queryKey: queryKeys.tokens,
        queryFn: () => listApiTokens(),
      }),
      context.queryClient.ensureQueryData({
        queryKey: queryKeys.aiSettings,
        queryFn: () => getAiSettings(),
      }),
      context.queryClient.ensureQueryData({
        queryKey: queryKeys.backups,
        queryFn: () => getBackups(),
      }),
      context.queryClient.ensureQueryData({
        queryKey: queryKeys.autoArchive,
        queryFn: async () => (await autoArchiveSetting()).enabled,
      }),
    ])
  },
  component: SettingsPage,
})

function SettingsPage() {
  const { session } = Route.useRouteContext()
  const router = useRouter()
  const { data: tokens } = useSuspenseQuery({
    queryKey: queryKeys.tokens,
    queryFn: () => listApiTokens(),
  })
  const { data: aiSettings } = useSuspenseQuery({
    queryKey: queryKeys.aiSettings,
    queryFn: () => getAiSettings(),
  })
  const { data: backupState } = useSuspenseQuery({
    queryKey: queryKeys.backups,
    queryFn: () => getBackups(),
  })
  const backupNow = useBackupNow()
  const saveAutoArchive = useSaveAutoArchive()
  const { data: autoArchive } = useSuspenseQuery({
    queryKey: queryKeys.autoArchive,
    queryFn: async () => (await autoArchiveSetting()).enabled,
  })
  const restoreBackup = useRestoreBackup()
  const removeBackup = useRemoveBackup()
  const updateRetention = useUpdateBackupRetention()
  const [backupMessage, setBackupMessage] = useState<string | null>(null)
  const createApiToken = useCreateApiToken()
  const revokeApiToken = useRevokeApiToken()
  const importBookmarks = useImportBookmarks()

  const [name, setName] = useState('')
  const [issuedKey, setIssuedKey] = useState<string | null>(null)
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null)
  const [readOnly, setReadOnly] = useState(false)

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => (await authClient.listSessions()).data ?? [],
  })
  const [sessionMessage, setSessionMessage] = useState<string | null>(null)

  const [twoFactorMessage, setTwoFactorMessage] = useState<{
    text: string
    tone: 'info' | 'warn' | 'error'
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [importSummary, setImportSummary] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const saveAiSettings = useSaveAiSettings()
  const clearAiKey = useClearAiKey()
  const testConnection = useTestAiConnection()
  const [aiBaseUrl, setAiBaseUrl] = useState(aiSettings.baseUrl ?? '')
  const [aiModel, setAiModel] = useState(aiSettings.model ?? '')
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiMessage, setAiMessage] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  function saveAi(event: FormEvent) {
    event.preventDefault()
    setAiError(null)
    setAiMessage(null)
    saveAiSettings.mutate(
      { baseUrl: aiBaseUrl, model: aiModel, apiKey: aiApiKey || undefined },
      {
        onSuccess: () => {
          setAiApiKey('')
          setAiMessage('saved')
        },
        onError: (cause) =>
          setAiError(
            cause instanceof Error ? cause.message : 'Failed to save AI settings',
          ),
      },
    )
  }

  function create(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setCopied(false)
    createApiToken.mutate(
      { name, expiresInDays, readOnly },
      {
        onSuccess: (created) => {
          setIssuedKey(created.key)
          setName('')
        },
        onError: (cause) =>
          setError(cause instanceof Error ? cause.message : 'Failed to create token'),
      },
    )
  }

  function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setImportError(null)
    setImportSummary(null)
    void file.text().then((contents) => {
      importBookmarks.mutate(
        { contents, filename: file.name },
        {
          onSuccess: (result) => {
            setImportSummary(
              `imported ${result.imported} · skipped ${result.duplicates} duplicates · ` +
                `${result.invalid} invalid · ${result.collectionsCreated} new collections · ` +
                `${result.tagsCreated} new tags`,
            )
          },
          onError: (cause) =>
            setImportError(cause instanceof Error ? cause.message : 'Import failed'),
        },
      )
      event.target.value = ''
    })
  }

  async function download(loader: () => Promise<{ filename: string; contents: string }>) {
    const { filename, contents } = await loader()
    const url = URL.createObjectURL(
      new Blob([contents], { type: 'application/octet-stream' }),
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="page">
      <AppHeader />
      <PageHeading title="settings" note="access, security, ai, and your data">
        <Link to="/api-docs" className="btn bg-sky">
          api reference
        </Link>
      </PageHeading>

      <Section
        tone="bg-sky"
        title="API tokens"
        note="for the extension and other clients"
        aside={tokens.length > 0 && <span className="chip">{tokens.length}</span>}
      >
        <form onSubmit={create} className="well flex flex-wrap items-end gap-3 p-3">
          <label className="flex min-w-0 flex-[1_1_16rem] flex-col gap-1.5">
            <span className="label">name</span>
            <input
              type="text"
              required
              placeholder="token name, e.g. chrome extension"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="field"
            />
          </label>
          <label className="flex flex-[1_1_10rem] flex-col gap-1.5 sm:flex-none">
            <span className="label">expiry</span>
            <select
              value={expiresInDays ?? ''}
              onChange={(event) =>
                setExpiresInDays(event.target.value ? Number(event.target.value) : null)
              }
              aria-label="Token expiry"
              className="field font-mono"
            >
              <option value="">never expires</option>
              <option value="30">expires in 30 days</option>
              <option value="90">expires in 90 days</option>
              <option value="365">expires in a year</option>
            </select>
          </label>
          <label className="flex h-10 items-center gap-2 font-mono text-xs font-semibold text-ink-muted">
            <input
              type="checkbox"
              checked={readOnly}
              onChange={(event) => setReadOnly(event.target.checked)}
              className="checkbox"
            />
            read-only
          </label>
          <button
            type="submit"
            className="btn-primary"
            disabled={createApiToken.isPending}
          >
            Create
          </button>
        </form>
        {error && <p className="font-mono text-xs text-danger">{error}</p>}

        {issuedKey && (
          <div className="notice flex flex-col gap-3 bg-accent p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="sticker bg-surface">shown once</span>
              <span className="label text-ink">copy it now</span>
            </div>
            <code className="rounded-md border-2 border-line bg-surface px-3 py-2 font-mono text-xs font-semibold break-all text-ink">
              {issuedKey}
            </code>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  await navigator.clipboard.writeText(issuedKey)
                  setCopied(true)
                }}
              >
                {copied ? 'copied' : 'copy'}
              </button>
              <button type="button" className="btn" onClick={() => setIssuedKey(null)}>
                done
              </button>
            </div>
          </div>
        )}

        {tokens.length === 0 ? (
          <p className="empty py-6">no tokens yet</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tokens.map((token) => (
              <li
                key={token.id}
                className="tile flex items-center justify-between gap-3 p-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold">
                    {token.name ?? 'unnamed'}
                  </span>
                  <span className="font-mono text-[11px] text-ink-faint">
                    {token.start ?? '•••'}… ·{' '}
                    {token.readOnly ? 'read-only' : 'read/write'} ·{' '}
                    {token.expiresAt
                      ? `expires ${new Date(token.expiresAt).toLocaleDateString()}`
                      : 'no expiry'}{' '}
                    · created {new Date(token.createdAt).toLocaleDateString()} ·{' '}
                    {token.lastRequest
                      ? `last used ${new Date(token.lastRequest).toLocaleDateString()}`
                      : 'never used'}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-danger shrink-0"
                  disabled={revokeApiToken.isPending}
                  onClick={() => revokeApiToken.mutate(token.id)}
                >
                  revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        tone="bg-mint"
        title="Two-factor"
        note={
          session.user.twoFactorEnabled
            ? 'enabled — sign-in asks for a code'
            : 'adds a TOTP code on top of your password'
        }
      >
        <TwoFactorSetup
          enabled={Boolean(session.user.twoFactorEnabled)}
          onMessage={(text, tone = 'info') => setTwoFactorMessage({ text, tone })}
          onChanged={() => void router.invalidate()}
        />

        {twoFactorMessage && (
          <p
            role="status"
            className={`font-mono text-xs ${
              twoFactorMessage.tone === 'error'
                ? 'text-danger'
                : twoFactorMessage.tone === 'warn'
                  ? 'text-warn'
                  : 'text-ink-muted'
            }`}
          >
            {twoFactorMessage.text}
          </p>
        )}
      </Section>

      <Section
        tone="bg-accent"
        title="Sessions"
        aside={sessions.length > 0 && <span className="chip">{sessions.length}</span>}
      >
        <ul className="flex flex-col gap-2">
          {sessions.map((item) => (
            <li
              key={item.id}
              className="tile flex items-center justify-between gap-3 p-3"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-semibold">
                  {item.userAgent ?? 'unknown device'}
                </span>
                <span className="font-mono text-[11px] text-ink-faint">
                  {item.ipAddress ?? 'no address'} · started{' '}
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </div>
              {item.id === session.session.id ? (
                <span className="chip shrink-0 bg-accent">this device</span>
              ) : (
                <button
                  type="button"
                  className="btn btn-danger shrink-0"
                  onClick={async () => {
                    const result = await authClient.revokeSession({ token: item.token })
                    setSessionMessage(
                      result.error ? 'could not revoke' : 'session revoked',
                    )
                  }}
                >
                  revoke
                </button>
              )}
            </li>
          ))}
        </ul>

        {(sessions.length > 1 || sessionMessage) && (
          <div className="flex flex-wrap items-center gap-3">
            {sessions.length > 1 && (
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  const result = await authClient.revokeOtherSessions()
                  setSessionMessage(
                    result.error ? 'could not revoke' : 'signed out other devices',
                  )
                }}
              >
                sign out other devices
              </button>
            )}
            {sessionMessage && (
              <p className="font-mono text-xs text-ink-muted">{sessionMessage}</p>
            )}
          </div>
        )}
      </Section>

      <Section
        tone="bg-lilac"
        title="AI"
        note={
          aiSettings.hasApiKey && aiSettings.model && aiSettings.baseUrl
            ? `configured: ${aiSettings.model} at ${aiSettings.baseUrl}`
            : 'openai-compatible endpoint · used by the toolbox · key stays in your database'
        }
      >
        <form onSubmit={saveAi} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="label">base url</span>
              <input
                type="url"
                required
                placeholder="https://api.openai.com/v1"
                value={aiBaseUrl}
                onChange={(event) => setAiBaseUrl(event.target.value)}
                className="field font-mono text-xs"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">model</span>
              <input
                type="text"
                required
                placeholder="gpt-4o-mini"
                value={aiModel}
                onChange={(event) => setAiModel(event.target.value)}
                className="field font-mono text-xs"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="label">api key</span>
            <input
              type="password"
              value={aiApiKey}
              onChange={(event) => setAiApiKey(event.target.value)}
              placeholder={
                aiSettings.hasApiKey
                  ? `stored ${aiSettings.apiKeyHint ?? ''} — leave blank to keep`
                  : 'sk-...'
              }
              className="field font-mono text-xs"
            />
          </label>

          <div className="mt-1 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="btn-primary"
              disabled={saveAiSettings.isPending}
            >
              {saveAiSettings.isPending ? 'saving…' : 'Save AI settings'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={!aiSettings.hasApiKey || testConnection.isPending}
              onClick={() =>
                testConnection.mutate(undefined, {
                  onSuccess: (result) => setAiMessage(`model replied: ${result.reply}`),
                  onError: (cause) =>
                    setAiMessage(cause instanceof Error ? cause.message : 'test failed'),
                })
              }
            >
              {testConnection.isPending ? 'testing…' : 'test connection'}
            </button>
            {aiSettings.hasApiKey && (
              <button
                type="button"
                className="btn btn-danger"
                disabled={clearAiKey.isPending}
                onClick={() =>
                  clearAiKey.mutate(undefined, {
                    onSuccess: () => setAiMessage('api key removed'),
                  })
                }
              >
                remove key
              </button>
            )}
          </div>

          {aiError && <p className="font-mono text-xs text-danger">{aiError}</p>}
          {aiMessage && <p className="font-mono text-xs text-ink-muted">{aiMessage}</p>}
        </form>
      </Section>

      <Section
        tone="bg-mint"
        title="Backups"
        note="daily at 03:00 UTC · restoring only adds bookmarks that are missing"
        aside={
          backupState.backups.length > 0 && (
            <span className="chip">{backupState.backups.length}</span>
          )
        }
      >
        <div className="well flex flex-wrap items-end gap-x-6 gap-y-3 p-3">
          <label className="flex flex-col gap-1.5">
            <span className="label">keep</span>
            <select
              value={backupState.retention}
              onChange={(event) => updateRetention.mutate(Number(event.target.value))}
              aria-label="Backup retention"
              className="field font-mono"
            >
              {[7, 30, 90, 365].map((days) => (
                <option key={days} value={days}>
                  {days} snapshots
                </option>
              ))}
            </select>
          </label>
          <label className="flex h-10 items-center gap-2 font-mono text-xs font-semibold text-ink-muted">
            <input
              type="checkbox"
              checked={autoArchive}
              disabled={saveAutoArchive.isPending}
              onChange={(event) => saveAutoArchive.mutate(event.target.checked)}
              className="checkbox"
            />
            snapshot every new save
          </label>
          <button
            type="button"
            className="btn-primary sm:ml-auto"
            disabled={backupNow.isPending}
            onClick={() =>
              backupNow.mutate(undefined, {
                onSuccess: (backup) =>
                  setBackupMessage(`backed up ${backup.key.split('/').pop()}`),
                onError: (cause) =>
                  setBackupMessage(
                    cause instanceof Error ? cause.message : 'backup failed',
                  ),
              })
            }
          >
            {backupNow.isPending ? 'writing…' : 'Back up now'}
          </button>
        </div>

        {backupState.backups.length > 0 && (
          <p className="font-mono text-[11px] text-ink-faint">
            {backupState.backups.length} backups · last{' '}
            {new Date(backupState.backups[0].uploaded).toLocaleString()}
          </p>
        )}
        {backupMessage && (
          <p className="font-mono text-xs text-ink-muted">{backupMessage}</p>
        )}

        {backupState.backups.length === 0 ? (
          <p className="empty py-6">no backups yet</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {backupState.backups.map((backup) => (
              <li
                key={backup.key}
                className="tile flex flex-wrap items-center justify-between gap-3 p-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold">
                    {backup.key.split('/').pop()}
                  </span>
                  <span className="font-mono text-[11px] text-ink-faint">
                    {new Date(backup.uploaded).toLocaleString()} ·{' '}
                    {(backup.size / 1024).toFixed(1)} KB
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    className="btn bg-mint"
                    disabled={restoreBackup.isPending}
                    onClick={() => {
                      if (
                        !confirm(
                          'Restore this backup? Missing bookmarks are added; existing ones are untouched.',
                        )
                      ) {
                        return
                      }
                      restoreBackup.mutate(backup.key, {
                        onSuccess: (summary) =>
                          setBackupMessage(
                            `restored ${summary.imported} bookmarks · skipped ${summary.duplicates} duplicates`,
                          ),
                        onError: (cause) =>
                          setBackupMessage(
                            cause instanceof Error ? cause.message : 'restore failed',
                          ),
                      })
                    }}
                  >
                    restore
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={removeBackup.isPending}
                    onClick={() => removeBackup.mutate(backup.key)}
                  >
                    delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        tone="bg-sky"
        title="Import / export"
        note="html · csv · enex · txt · json · netscape html · markdown · folders become collections"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="flex flex-col gap-1.5">
              <span className="label">import a file</span>
              <input
                type="file"
                accept=".html,.htm,.csv,.enex,.txt,text/html,text/csv,text/plain"
                onChange={importFile}
                disabled={importBookmarks.isPending}
                className="w-full min-w-0 font-mono text-xs text-ink-muted file:mr-3 file:cursor-pointer file:rounded-md file:border-2 file:border-line file:bg-surface file:px-2.5 file:py-1 file:font-mono file:text-xs file:font-semibold file:text-ink file:shadow-hard-xs"
              />
            </label>
            {importBookmarks.isPending && (
              <span className="font-mono text-xs text-ink-faint">importing…</span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="label">export</span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn"
                onClick={() => void download(exportJson)}
              >
                download json
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => void download(exportNetscape)}
              >
                download html
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => void download(exportMarkdown)}
              >
                download markdown
              </button>
            </div>
          </div>
        </div>
        {importSummary && <p className="font-mono text-xs text-ok">{importSummary}</p>}
        {importError && <p className="font-mono text-xs text-danger">{importError}</p>}
      </Section>
    </main>
  )
}

/** A settings section: a panel with a toned head (title, note, aside) over a padded body. */
function Section({
  tone,
  title,
  note,
  aside,
  children,
}: {
  tone: string
  title: string
  note?: ReactNode
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="panel">
      <div className={`panel-head ${tone}`}>
        <h2 className="section-title">{title}</h2>
        {aside}
        {note && (
          <p className="basis-full text-sm text-ink-muted wrap-anywhere">{note}</p>
        )}
      </div>
      <div className="flex flex-col gap-3 p-4">{children}</div>
    </section>
  )
}
