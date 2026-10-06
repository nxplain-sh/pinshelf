/// <reference types="vite/client" />
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  useRouterState,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Toolbox } from '~/components/Toolbox'
import { CommandPalette } from '~/components/CommandPalette'
import appCss from '~/styles/app.css?url'
import monoFont from '~/styles/fonts/jetbrains-mono-latin-wght-normal.woff2?url'
import sansFont from '~/styles/fonts/space-grotesk-latin-wght-normal.woff2?url'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#f4eee1' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-title', content: 'pinshelf' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      { title: 'pinshelf' },
      { name: 'description', content: 'Self-hosted bookmark manager' },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: 'pinshelf' },
      { property: 'og:description', content: 'Self-hosted bookmark manager' },
      { property: 'og:image', content: '/social-card.png' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:image', content: '/social-card.png' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      // Same hashed urls the stylesheet's @font-face rules resolve to, so the
      // preload is reused instead of fetched twice.
      {
        rel: 'preload',
        href: sansFont,
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'preload',
        href: monoFont,
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  // The API reference has its own sidebar footer where this button would sit.
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  useEffect(() => {
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js')
    }
  }, [])

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen">
        {children}
        <CommandPalette />
        <Toolbox />
        {pathname !== '/api-docs' && (
          <a
            href="https://pinshelf.app/docs"
            target="_blank"
            rel="noreferrer"
            className="btn fixed bottom-5 left-5 z-40 bg-sky px-3 py-1.5"
          >
            docs
          </a>
        )}
        <Scripts />
      </body>
    </html>
  )
}
