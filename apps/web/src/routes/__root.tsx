/// <reference types="vite/client" />
import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Toolbox } from '~/components/Toolbox'
import { CommandPalette } from '~/components/CommandPalette'
import appCss from '~/styles/app.css?url'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#131110' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-title', content: 'pinshelf' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
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
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
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
        <a
          href="https://pinshelf.app/docs"
          target="_blank"
          rel="noreferrer"
          className="btn fixed bottom-5 left-5 z-40 border-accent/50 bg-surface text-accent"
        >
          docs
        </a>
        <Scripts />
      </body>
    </html>
  )
}
