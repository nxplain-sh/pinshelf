import { defineConfig } from 'wxt'

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'pinshelf',
    description: 'Save the page you are on to your pinshelf instance.',
    permissions: ['activeTab', 'contextMenus', 'storage', 'tabs', 'sidePanel'],
    host_permissions: ['https://app.pinshelf.app/*', 'http://localhost:3000/*'],
    omnibox: { keyword: 'pin' },
    side_panel: { default_path: 'sidepanel.html' },
    action: {
      default_title: 'Save to pinshelf',
    },
  },
})
