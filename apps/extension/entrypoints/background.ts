import { browser } from 'wxt/browser'
import { createHighlight, findSaved, saveBookmark, searchBookmarks } from '../utils/api'
import { apiBaseUrl, savedPageIndicator } from '../utils/settings'

const MENU_ID = 'pinshelf-save'
const HIGHLIGHT_ID = 'pinshelf-highlight'
const FLASH_MS = 3000
// Badge colours mirror app.css: accent fill for saved, coral for failed, ink
// text on both (the browser's default white is unreadable on either fill).
const BADGE_OK = '#fcc93a'
const BADGE_FAIL = '#ff8f7d'
const BADGE_TEXT = '#131110'

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: MENU_ID,
      title: 'Save to pinshelf',
      contexts: ['page', 'link'],
    })
    browser.contextMenus.create({
      id: HIGHLIGHT_ID,
      title: 'Highlight selection in pinshelf',
      contexts: ['selection'],
    })
  })

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === HIGHLIGHT_ID) {
      const quote = info.selectionText?.trim()
      const url = info.pageUrl ?? tab?.url
      if (!quote || !url) return
      await saveHighlight(url, quote, tab?.id)
      return
    }
    if (info.menuItemId !== MENU_ID) return
    const url = info.linkUrl ?? info.pageUrl ?? tab?.url
    if (!url) return

    const result = await saveBookmark({ url })
    await flashBadge(result.ok ? '✓' : '!', result.ok ? BADGE_OK : BADGE_FAIL, tab?.id)
  })

  // Saved-page indicator: mark tabs whose url is already in the library.
  // Checks run on navigation and tab switch only, never in the background.
  browser.tabs.onActivated.addListener(({ tabId }) => {
    void browser.tabs.get(tabId).then((tab) => refreshBadge(tabId, tab.url))
  })

  browser.tabs.onUpdated.addListener((tabId, change) => {
    if (change.status === 'complete' || change.url) {
      void browser.tabs.get(tabId).then((tab) => refreshBadge(tabId, tab.url))
    }
  })

  browser.omnibox.onInputChanged.addListener(async (text, suggest) => {
    const term = text.trim()
    if (!term) return
    const result = await searchBookmarks(term)
    if (!result.ok) return
    suggest(
      result.data.bookmarks.slice(0, 6).map((bookmark) => ({
        content: bookmark.url,
        description: `${bookmark.title ?? bookmark.url} — ${bookmark.url}`,
      })),
    )
  })

  browser.omnibox.setDefaultSuggestion({
    description: 'search pinshelf for "%s" · enter opens the instance',
  })

  browser.omnibox.onInputEntered.addListener(async (text) => {
    const term = text.trim()
    if (!term) return
    await browser.tabs.create({ url: await instanceUrl(term) })
  })

  // Older browsers lack this call; it runs last and guarded so a failure here
  // never skips the listeners above.
  void browser.action?.setBadgeTextColor?.({ color: BADGE_TEXT })
})

/** Highlights hang off a bookmark, so save the page first when it is new. */
async function saveHighlight(url: string, quote: string, tabId?: number) {
  const existing = await findSaved(url)
  let bookmarkId = existing.ok ? existing.data.bookmarks[0]?.id : undefined

  if (!bookmarkId) {
    const saved = await saveBookmark({ url })
    bookmarkId = saved.ok ? saved.data.bookmark.id : undefined
    if (saved.ok && !saved.data.duplicate) {
      await flashBadge('✓', BADGE_OK, tabId)
    }
  }
  if (!bookmarkId) {
    await flashBadge('!', BADGE_FAIL, tabId)
    return
  }

  const result = await createHighlight({ bookmarkId, quote })
  await flashBadge(result.ok ? '✓' : '!', result.ok ? BADGE_OK : BADGE_FAIL, tabId)
}

async function refreshBadge(tabId: number, url: string | undefined) {
  const enabled = await savedPageIndicator.getValue()
  if (!enabled || !url || !/^https?:/i.test(url)) {
    await browser.action.setBadgeText({ tabId, text: '' })
    return
  }

  const result = await findSaved(url)
  // A 401 or an unreachable instance shows nothing rather than a wrong mark.
  await browser.action.setBadgeText({
    tabId,
    text: result.ok && result.data.bookmarks.length > 0 ? '✓' : '',
  })
  if (result.ok && result.data.bookmarks.length > 0) {
    await browser.action.setBadgeBackgroundColor({ tabId, color: BADGE_OK })
  }
}

async function flashBadge(text: string, color: string, tabId?: number) {
  await browser.action.setBadgeBackgroundColor({ tabId, color })
  await browser.action.setBadgeText({ tabId, text })
  setTimeout(() => {
    if (tabId === undefined) {
      void browser.action.setBadgeText({ text: '' })
      return
    }
    void browser.tabs.get(tabId).then((tab) => refreshBadge(tabId, tab.url))
  }, FLASH_MS)
}

/** A bare term becomes an instance search; a url opens as-is. */
async function instanceUrl(term: string): Promise<string> {
  if (/^https?:\/\//i.test(term)) return term
  const base = (await apiBaseUrl.getValue()).replace(/\/+$/, '')
  return `${base}/?q=${encodeURIComponent(term)}`
}
