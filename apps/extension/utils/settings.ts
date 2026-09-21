import { storage } from '#imports'

export const DEFAULT_API_BASE_URL = 'https://app.pinshelf.app'

export const apiBaseUrl = storage.defineItem<string>('local:apiBaseUrl', {
  fallback: DEFAULT_API_BASE_URL,
})

export const apiToken = storage.defineItem<string | null>('local:apiToken', {
  fallback: null,
})

export const savedPageIndicator = storage.defineItem<boolean>(
  'local:savedPageIndicator',
  { fallback: true },
)
