// pinshelf site — copy buttons, mobile nav, install tabs, docs filter. Everything
// here is optional: without JavaScript the pages stay readable, the first install
// panel shows, and the tab strip, copy buttons, and docs filter are hidden by CSS.

const TICK_ICON = `<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10.5l4 4 8-9"/></svg>`

function fallbackCopy(text) {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.append(area)
  area.select()
  document.execCommand('copy')
  area.remove()
}

for (const button of document.querySelectorAll('.copy')) {
  const original = button.innerHTML
  button.addEventListener('click', async () => {
    const text =
      button.getAttribute('data-copy') ??
      button.closest('.codeblock-wrap')?.querySelector('pre')?.textContent ??
      ''
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      fallbackCopy(text)
    }
    button.innerHTML = TICK_ICON
    button.setAttribute('data-copied', '')
    button.setAttribute('aria-label', 'Copied')
    setTimeout(() => {
      button.innerHTML = original
      button.removeAttribute('data-copied')
      button.setAttribute('aria-label', 'Copy command')
    }, 2000)
  })
}

const toggle = document.querySelector('.nav-toggle')
const nav = document.getElementById('site-nav')

if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true'
    toggle.setAttribute('aria-expanded', String(!open))
    if (open) nav.removeAttribute('data-open')
    else nav.setAttribute('data-open', '')
  })
}

const tabs = [...document.querySelectorAll('[role="tab"]')]

function selectTab(tab) {
  for (const other of tabs) {
    const selected = other === tab
    other.setAttribute('aria-selected', String(selected))
    const panel = document.getElementById(other.getAttribute('aria-controls') ?? '')
    if (panel) panel.hidden = !selected
  }
}

for (const [index, tab] of tabs.entries()) {
  tab.addEventListener('click', () => selectTab(tab))
  tab.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const step = event.key === 'ArrowRight' ? 1 : -1
    const next = tabs[(index + step + tabs.length) % tabs.length]
    next.focus()
    selectTab(next)
  })
}

const filter = document.querySelector('.docs-filter')

if (filter) {
  const items = [...document.querySelectorAll('.docs-side li')]
  const groups = [...document.querySelectorAll('.docs-side .side-group')]
  filter.addEventListener('input', () => {
    const query = filter.value.trim().toLowerCase()
    for (const item of items) {
      item.hidden = !item.textContent.toLowerCase().includes(query)
    }
    for (const group of groups) {
      group.hidden = !group.nextElementSibling?.querySelector('li:not([hidden])')
    }
  })
}
