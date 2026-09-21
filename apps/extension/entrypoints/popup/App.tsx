import { useEffect, useState } from 'react'
import { browser } from 'wxt/browser'
import { askBookmark, fetchCollections, findSaved, saveBookmark } from '@/utils/api'
import type { Collection } from '@/utils/api'
import {
  DEFAULT_API_BASE_URL,
  apiBaseUrl,
  apiToken,
  savedPageIndicator,
} from '@/utils/settings'

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
  const [indicator, setIndicator] = useState(true)
  const [tabCount, setTabCount] = useState(0)
  const [answer, setAnswer] = useState<{ text: string; source: string } | null>(null)

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
      setIndicator(await savedPageIndicator.getValue())

      const tabs = await browser.tabs.query({ currentWindow: true })
      setTabCount(tabs.filter((entry) => /^https?:/i.test(entry.url ?? '')).length)

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

  async function summarise() {
    setPending(true)
    setMessage(null)
    setAnswer(null)

    const existing = await findSaved(pageUrl)
    const bookmarkId = existing.ok ? existing.data.bookmarks[0]?.id : undefined
    if (!bookmarkId) {
      setMessage({ kind: 'error', text: 'save the page first, then ask' })
      setPending(false)
      return
    }

    const result = await askBookmark(bookmarkId, 'summary')
    if (result.ok) setAnswer(result.data)
    else setMessage({ kind: 'error', text: result.error })
    setPending(false)
  }

  async function openSidebar() {
    const panel = (
      browser as unknown as {
        sidePanel?: { open: (options: { windowId: number }) => Promise<void> }
      }
    ).sidePanel
    if (!panel) {
      setMessage({ kind: 'error', text: 'the sidebar needs Chrome or Edge' })
      return
    }
    const window = await browser.windows.getCurrent()
    if (window.id === undefined) return
    await panel.open({ windowId: window.id })
    await browser.windows.remove(window.id)
  }

  async function saveAllTabs() {
    setPending(true)
    setMessage(null)

    const tabs = await browser.tabs.query({ currentWindow: true })
    const urls = tabs
      .map((entry) => entry.url ?? '')
      .filter((url) => /^https?:/i.test(url))

    let saved = 0
    let duplicate = 0
    let failed = 0
    for (const url of urls) {
      const result = await saveBookmark({ url })
      if (!result.ok) failed++
      else if (result.data.duplicate) duplicate++
      else saved++
    }

    setMessage({
      kind: failed > 0 ? 'error' : 'ok',
      text: `saved ${saved} · already there ${duplicate}${failed > 0 ? ` · failed ${failed}` : ''}`,
    })
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
          <label className="check">
            <input
              type="checkbox"
              checked={indicator}
              onChange={(event) => {
                setIndicator(event.target.checked)
                void savedPageIndicator.setValue(event.target.checked)
              }}
            />
            saved-page badge
          </label>
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
            <button
              type="button"
              className="btn"
              disabled={pending || !hasToken || tabCount === 0}
              onClick={saveAllTabs}
              title="Save every open tab in this window"
            >
              all tabs ({tabCount})
            </button>
            <button
              type="button"
              className="btn"
              disabled={pending || !hasToken || !pageUrl}
              onClick={summarise}
              title="Ask the configured model to summarise this page"
            >
              summarise
            </button>
            <button type="button" className="btn" onClick={openSidebar}>
              sidebar
            </button>
            {!hasToken && <span className="muted">set a token in settings first</span>}
          </div>
        </>
      )}

      {answer && (
        <div className="answer">
          <span className="muted">summary · read from {answer.source}</span>
          <p>{answer.text}</p>
        </div>
      )}

      {message && (
        <span className={message.kind === 'ok' ? 'message-ok' : 'message-error'}>
          {message.text}
        </span>
      )}
    </div>
  )
}
