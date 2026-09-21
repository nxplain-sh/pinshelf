import { useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import { fetchCollections, saveBookmark } from '@/utils/api'
import type { Collection } from '@/utils/api'
import { DEFAULT_API_BASE_URL, apiBaseUrl, apiToken } from '@/utils/settings'

type Message = { kind: 'ok' | 'error'; text: string }

export function App() {
  const [ready, setReady] = useState(false)
  const [baseUrl, setBaseUrl] = useState(DEFAULT_API_BASE_URL)
  const [hasToken, setHasToken] = useState(false)
  const [tokenDraft, setTokenDraft] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  const [pageUrl, setPageUrl] = useState('')
  const [pageTitle, setPageTitle] = useState('')
  const [tags, setTags] = useState('')
  const [collectionId, setCollectionId] = useState('')
  const [collections, setCollections] = useState<Collection[]>([])
  const [message, setMessage] = useState<Message | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    void (async () => {
      const [storedBase, storedToken] = await Promise.all([
        apiBaseUrl.getValue(),
        apiToken.getValue(),
      ])
      setBaseUrl(storedBase)
      setHasToken(Boolean(storedToken))
      setShowSettings(!storedToken)
      setTokenDraft(storedToken ?? '')

      const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
      setPageUrl(tab?.url ?? '')
      setPageTitle(tab?.title ?? '')

      if (storedToken) {
        const result = await fetchCollections()
        if (result.ok) setCollections(result.data.collections)
        else if (result.status === 401) {
          setMessage({ kind: 'error', text: 'token rejected — check settings' })
        }
      }

      setReady(true)
    })()
  }, [])

  async function saveSettings() {
    const trimmedBase = baseUrl.trim().replace(/\/+$/, '') || DEFAULT_API_BASE_URL
    await apiBaseUrl.setValue(trimmedBase)
    await apiToken.setValue(tokenDraft.trim() || null)
    setBaseUrl(trimmedBase)
    setHasToken(Boolean(tokenDraft.trim()))
    setShowSettings(false)
    setMessage(null)

    const result = await fetchCollections()
    if (result.ok) setCollections(result.data.collections)
    else if (result.status === 401) {
      setMessage({ kind: 'error', text: 'token rejected by the server' })
    } else {
      setMessage({ kind: 'error', text: result.error })
    }
  }

  async function save() {
    if (!pageUrl) {
      setMessage({ kind: 'error', text: 'no page url to save' })
      return
    }
    setPending(true)
    setMessage(null)

    const result = await saveBookmark({
      url: pageUrl,
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      collectionId: collectionId || null,
    })

    if (result.ok) {
      setMessage({
        kind: 'ok',
        text: result.data.duplicate ? 'already saved' : 'saved',
      })
      setTags('')
    } else if (result.status === 401) {
      setMessage({ kind: 'error', text: 'token rejected — open settings' })
      setShowSettings(true)
    } else {
      setMessage({ kind: 'error', text: result.error })
    }

    setPending(false)
  }

  if (!ready) {
    return (
      <div className="wrap">
        <span className="muted">loading…</span>
      </div>
    )
  }

  return (
    <div className="wrap">
      <div className="head">
        <span className="brand">
          <img src="/mark.svg" alt="" width={14} height={14} />
          pinshelf
        </span>
        <button
          type="button"
          className="link"
          onClick={() => setShowSettings((value) => !value)}
        >
          {showSettings ? 'cancel' : 'settings'}
        </button>
      </div>

      {showSettings ? (
        <>
          <span className="label">api base url</span>
          <input
            className="field"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder={DEFAULT_API_BASE_URL}
          />
          <span className="label">api token</span>
          <input
            className="field"
            type="password"
            value={tokenDraft}
            onChange={(event) => setTokenDraft(event.target.value)}
            placeholder="paste a token"
          />
          <span className="muted">
            create one at {baseUrl.replace(/\/+$/, '')}/settings
          </span>
          <div className="row">
            <button type="button" className="btn-primary" onClick={saveSettings}>
              Save settings
            </button>
            <button
              type="button"
              className="btn"
              onClick={() =>
                void browser.tabs.create({
                  url: `${baseUrl.replace(/\/+$/, '')}/settings`,
                })
              }
            >
              open instance
            </button>
          </div>
        </>
      ) : (
        <>
          <span className="title">{pageTitle || 'untitled page'}</span>
          <span className="url">{pageUrl}</span>

          <span className="label">tags</span>
          <input
            className="field"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="comma separated"
          />

          <span className="label">collection</span>
          <select
            className="field"
            value={collectionId}
            onChange={(event) => setCollectionId(event.target.value)}
          >
            <option value="">no collection</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </select>

          <div className="row">
            <button
              type="button"
              className="btn-primary"
              disabled={pending || !hasToken}
              onClick={save}
            >
              {pending ? 'saving…' : 'Save'}
            </button>
            {!hasToken && <span className="muted">set a token in settings first</span>}
          </div>
        </>
      )}

      {message && (
        <span className={message.kind === 'ok' ? 'message-ok' : 'message-error'}>
          {message.text}
        </span>
      )}
    </div>
  )
}
