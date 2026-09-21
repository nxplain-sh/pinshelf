import { apiBaseUrl } from '@/utils/settings'

// The panel is a frame around the real app: one navigation, no duplicate UI.
void apiBaseUrl.getValue().then((base) => {
  window.location.replace(base.replace(/\/+$/, ''))
})
