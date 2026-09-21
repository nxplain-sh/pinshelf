import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { authClient } from '~/lib/auth'
import { TwoFactorSetup } from '~/components/TwoFactorSetup'
import { exportJson, exportMarkdown, exportNetscape } from '~/lib/import-export'
import { getAiSettings } from '~/lib/ai'
import { getBackups } from '~/lib/backup'
import {
  queryKeys,
  useClearAiKey,
  useCreateApiToken,
  useImportBookmarks,
  useMergeTag,
  useRenameTag,
  useRevokeApiToken,
  useBackupNow,
  useRemoveBackup,
  useRestoreBackup,
  useSaveAiSettings,
  useTestAiConnection,
  useUpdateBackupRetention,
} from '~/lib/queries'
import { fetchSession } from '~/lib/session'
import { listTags } from '~/lib/taxonomy'
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
  const { data: tags } = useSuspenseQuery({
    queryKey: queryKeys.tags,
    queryFn: () => listTags(),
  })
  const renameTag = useRenameTag()
  const mergeTag = useMergeTag()
  const [tagNames, setTagNames] = useState<Record<string, string>>({})
  const [mergeFrom, setMergeFrom] = useState('')
  const [mergeInto, setMergeInto] = useState('')
  const [tagMessage, setTagMessage] = useState<string | null>(null)
  const backupNow = useBackupNow()
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
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 p-6">
      <header className="flex items-center justify-between border-b border-line pb-4">
        <Link
          to="/"
          className="font-mono text-xs text-ink-muted transition-colors hover:text-ink"
        >
          ← pinshelf
        </Link>
        <div className="flex items-center gap-4">
          <Link
            to="/api-docs"
            className="font-mono text-xs text-ink-muted transition-colors hover:text-ink"
          >
            api reference
          </Link>
          <span className="font-mono text-xs text-ink-faint">settings</span>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">API tokens</h2>
          <p className="font-mono text-[11px] text-ink-faint">
            used by the browser extension and any other client
          </p>
        </div>

        <form onSubmit={create} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            required
            placeholder="token name, e.g. chrome extension"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="field flex-1"
          />
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
          <label className="flex items-center gap-2 font-mono text-xs text-ink-muted">
            <input
              type="checkbox"
              checked={readOnly}
              onChange={(event) => setReadOnly(event.target.checked)}
              className="checkbox h-3.5 w-3.5"
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
          <div className="panel flex flex-col gap-2 border-accent/40 p-3">
            <span className="label">copy it now — it is shown once</span>
            <code className="overflow-x-auto font-mono text-xs break-all text-accent">
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
          <p className="border border-dashed border-line py-8 text-center font-mono text-xs text-ink-faint">
            no tokens yet
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {tokens.map((token) => (
              <li
                key={token.id}
                className="panel flex items-center justify-between gap-3 p-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm">{token.name ?? 'unnamed'}</span>
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
                  className="btn shrink-0"
                  disabled={revokeApiToken.isPending}
                  onClick={() => revokeApiToken.mutate(token.id)}
                >
                  revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-line pt-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">Two-factor</h2>
          <p className="font-mono text-[11px] text-ink-faint">
            {session.user.twoFactorEnabled
              ? 'enabled — sign-in asks for a code from your authenticator'
              : 'add a TOTP code from any authenticator app on top of your password'}
          </p>
        </div>

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
      </section>

      <section className="flex flex-col gap-3 border-t border-line pt-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">Sessions</h2>
          <p className="font-mono text-[11px] text-ink-faint">
            every device signed into this instance
          </p>
        </div>

        <ul className="flex flex-col gap-1.5">
          {sessions.map((item) => (
            <li
              key={item.id}
              className="panel flex items-center justify-between gap-3 p-3"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-mono text-xs text-ink-muted">
                  {item.userAgent ?? 'unknown device'}
                </span>
                <span className="font-mono text-[11px] text-ink-faint">
                  {item.ipAddress ?? 'no address'} · started{' '}
                  {new Date(item.createdAt).toLocaleString()}
                  {item.id === session.session.id ? ' · this device' : ''}
                </span>
              </div>
              {item.id !== session.session.id && (
                <button
                  type="button"
                  className="btn shrink-0"
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

        {sessions.length > 1 && (
          <button
            type="button"
            className="btn self-start"
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
      </section>

      <section className="flex flex-col gap-3 border-t border-line pt-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">AI</h2>
          <p className="font-mono text-[11px] text-ink-faint">
            any OpenAI-compatible endpoint · used by the cleanup page to find duplicates
            and suggest tags and descriptions · the key is stored in your database and
            never sent to the browser again
          </p>
        </div>

        <form onSubmit={saveAi} className="flex flex-col gap-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
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
            <label className="flex flex-col gap-1">
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
          <label className="flex flex-col gap-1">
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

          <div className="flex flex-wrap items-center gap-2">
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
                className="btn"
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
          {aiMessage && <p className="font-mono text-xs text-accent">{aiMessage}</p>}
          <p className="font-mono text-[11px] text-ink-faint">
            {aiSettings.hasApiKey && aiSettings.model && aiSettings.baseUrl
              ? `configured: ${aiSettings.model} at ${aiSettings.baseUrl}`
              : 'not configured'}
          </p>
        </form>
      </section>

      <section className="flex flex-col gap-3 border-t border-line pt-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">Backups</h2>
          <p className="font-mono text-[11px] text-ink-faint">
            json snapshots in your own R2 bucket · one is written daily at 03:00 UTC · the
            newest {backupState.retention} are kept · restoring adds what is missing and
            never overwrites existing bookmarks
          </p>
        </div>

        <div className="flex items-center gap-2">
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
          <span className="font-mono text-[11px] text-ink-faint">
            schedule is fixed at deploy time in wrangler.jsonc
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-primary"
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
          <span className="font-mono text-[11px] text-ink-faint">
            {backupState.backups.length === 0
              ? 'no backups yet'
              : `${backupState.backups.length} backups · last ${new Date(
                  backupState.backups[0].uploaded,
                ).toLocaleString()}`}
          </span>
        </div>
        {backupMessage && (
          <p className="font-mono text-xs text-accent">{backupMessage}</p>
        )}

        {backupState.backups.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {backupState.backups.map((backup) => (
              <li
                key={backup.key}
                className="panel flex items-center justify-between gap-3 p-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-mono text-xs">
                    {backup.key.split('/').pop()}
                  </span>
                  <span className="font-mono text-[11px] text-ink-faint">
                    {new Date(backup.uploaded).toLocaleString()} ·{' '}
                    {(backup.size / 1024).toFixed(1)} KB
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="btn"
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
                    className="btn"
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
      </section>

      <section className="flex flex-col gap-3 border-t border-line pt-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">Import</h2>
          <p className="font-mono text-[11px] text-ink-faint">
            html (chrome, firefox, safari, raindrop) · csv · enex (evernote) · txt ·
            nested folders become "parent/child" collections · metadata is not fetched on
            import
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".html,.htm,.csv,.enex,.txt,text/html,text/csv,text/plain"
            onChange={importFile}
            disabled={importBookmarks.isPending}
            className="font-mono text-xs text-ink-muted file:mr-2 file:rounded-md file:border file:border-line file:bg-transparent file:px-2.5 file:py-1 file:font-mono file:text-xs file:text-ink-muted"
          />
          {importBookmarks.isPending && (
            <span className="font-mono text-xs text-ink-faint">importing…</span>
          )}
        </div>
        {importSummary && (
          <p className="font-mono text-xs text-accent">{importSummary}</p>
        )}
        {importError && <p className="font-mono text-xs text-danger">{importError}</p>}
      </section>

      <section className="flex flex-col gap-3 border-t border-line pt-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">Tags</h2>
          <p className="font-mono text-[11px] text-ink-faint">
            rename a tag, or merge one into another when they mean the same thing
          </p>
        </div>

        <ul className="flex flex-col gap-2">
          {tags.map((tag) => (
            <li key={tag.id} className="flex items-center gap-2">
              <input
                value={tagNames[tag.id] ?? tag.name}
                onChange={(event) =>
                  setTagNames((current) => ({ ...current, [tag.id]: event.target.value }))
                }
                aria-label={`Rename ${tag.name}`}
                className="field flex-1 font-mono"
              />
              <button
                type="button"
                className="btn"
                disabled={
                  renameTag.isPending ||
                  (tagNames[tag.id] ?? tag.name).trim() === tag.name
                }
                onClick={() => {
                  setTagMessage(null)
                  renameTag.mutate(
                    { id: tag.id, name: tagNames[tag.id] ?? tag.name },
                    {
                      onSuccess: (result) => {
                        setTagNames((current) => {
                          const next = { ...current }
                          delete next[tag.id]
                          return next
                        })
                        setTagMessage(result.error ?? `renamed to "${result.tag?.name}"`)
                      },
                    },
                  )
                }}
              >
                rename
              </button>
            </li>
          ))}
          {tags.length === 0 && (
            <li className="font-mono text-[11px] text-ink-faint">no tags yet</li>
          )}
        </ul>

        {tags.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={mergeFrom}
              onChange={(event) => setMergeFrom(event.target.value)}
              aria-label="Merge this tag"
              className="field font-mono"
            >
              <option value="">merge this…</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
            <span className="font-mono text-xs text-ink-faint">into</span>
            <select
              value={mergeInto}
              onChange={(event) => setMergeInto(event.target.value)}
              aria-label="Into this tag"
              className="field font-mono"
            >
              <option value="">…into this</option>
              {tags
                .filter((tag) => tag.id !== mergeFrom)
                .map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
            </select>
            <button
              type="button"
              className="btn"
              disabled={mergeTag.isPending || !mergeFrom || !mergeInto}
              onClick={() => {
                setTagMessage(null)
                mergeTag.mutate(
                  { fromId: mergeFrom, intoId: mergeInto },
                  {
                    onSuccess: (result) => {
                      setMergeFrom('')
                      setMergeInto('')
                      setTagMessage(result.error ?? `merged ${result.moved} bookmarks`)
                    },
                  },
                )
              }}
            >
              merge
            </button>
          </div>
        )}

        {tagMessage && <p className="font-mono text-xs text-ink-muted">{tagMessage}</p>}
      </section>

      <section className="flex flex-col gap-3 border-t border-line pt-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">Export</h2>
          <p className="font-mono text-[11px] text-ink-faint">
            full backup as json, netscape html for other bookmark managers, or a markdown
            reading list
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn" onClick={() => void download(exportJson)}>
            download json
          </button>{' '}
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
      </section>
    </main>
  )
}
