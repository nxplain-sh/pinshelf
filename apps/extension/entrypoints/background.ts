import { browser } from 'wxt/browser'
import { saveBookmark } from '../utils/api'

const MENU_ID = 'pinshelf-save'

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: MENU_ID,
      title: 'Save to pinshelf',
      contexts: ['page', 'link'],
    })
  })

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== MENU_ID) return
    const url = info.linkUrl ?? info.pageUrl ?? tab?.url
    if (!url) return

    const result = await saveBookmark({ url })
    await flashBadge(result.ok ? '✓' : '!', result.ok ? '#c9a227' : '#d2604f')
  })
})

async function flashBadge(text: string, color: string) {
  await browser.action.setBadgeBackgroundColor({ color })
  await browser.action.setBadgeText({ text })
  setTimeout(() => {
    void browser.action.setBadgeText({ text: '' })
  }, 3000)
}
