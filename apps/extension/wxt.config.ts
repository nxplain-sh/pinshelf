import { defineConfig } from 'wxt'

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'pinshelf',
    description: 'Save the page you are on to your pinshelf instance.',
    permissions: ['activeTab', 'contextMenus', 'storage'],
    host_permissions: ['https://app.pinshelf.app/*', 'http://localhost:3000/*'],
    action: {
      default_title: 'Save to pinshelf',
    },
  },
})
