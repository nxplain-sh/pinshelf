import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { Suspense, lazy, useEffect, useState } from 'react'
import { buildOpenApiDocument } from '~/lib/openapi'
import { fetchSession } from '~/lib/session'

const ApiReference = lazy(async () => {
  // Scalar's layout lives in its own stylesheet; without this import the
  // reference renders as an unstyled document. Loaded with the chunk so it
  // never reaches the app's initial CSS.
  await import('@scalar/api-reference-react/style.css')
  const module = await import('@scalar/api-reference-react')
  return { default: module.ApiReferenceReact }
})

export const Route = createFileRoute('/api-docs')({
  // Client-only: Scalar pulls a Vue runtime that has no business in the SSR
  // bundle, where it would eat into the Worker size limit for no benefit.
  ssr: false,
  beforeLoad: async () => {
    const session = await fetchSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    return { session }
  },
  component: ApiDocs,
})

function ApiDocs() {
  // Scalar renders a client-only widget; keep it out of SSR and out of the
  // main bundle by loading it lazily on this route.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-line px-6 py-3">
        <Link
          to="/"
          className="font-mono text-xs text-ink-muted transition-colors hover:text-ink"
        >
          ← pinshelf
        </Link>
        <span className="font-mono text-xs text-ink-faint">api reference</span>
      </header>

      {mounted ? (
        <Suspense
          fallback={
            <p className="p-6 font-mono text-xs text-ink-faint">loading api reference…</p>
          }
        >
          <ApiReference
            configuration={{
              content: buildOpenApiDocument(window.location.origin),
              theme: 'default',
              darkMode: true,
              forceDarkModeState: 'dark',
              hideDarkModeToggle: true,
              hideClientButton: false,
              // The MCP/agent promo and the IDE links are noise for a
              // self-hosted bookmark API.
              mcp: { disabled: true },
              showDeveloperTools: 'never',
              // The "Test it" client needs the token before it can send a
              // request; ask for it up front instead of failing with 401s.
              authentication: {
                preferredSecurityScheme: 'bearerAuth',
              },
              metaData: { title: 'pinshelf API' },
              // Scalar ships its own palette; nudge the few variables that
              // matter so the reference sits inside the app's dark theme
              // instead of next to it.
              customCss: [
                ':root, .light-mode, .dark-mode {',
                '  --scalar-color-accent: #c9a227;',
                '  --scalar-background-1: #131110;',
                '  --scalar-background-2: #1a1715;',
                '  --scalar-background-3: #221e1b;',
                '  --scalar-color-1: #f2ece2;',
                '  --scalar-color-2: #b3a99b;',
                '  --scalar-color-3: #837a6d;',
                '  --scalar-border-color: #2e2925;',
                '  --scalar-radius: 4px;',
                '  --scalar-radius-lg: 6px;',
                '}',
                // Scalar's agent button needs a Scalar account to do anything;
                // on a self-hosted reference it is a dead end. Selector is
                // scoped to the button so the search field survives.
                'button.bg-sidebar-b-search.whitespace-nowrap { display: none !important; }',
              ].join('\n'),
            }}
          />
        </Suspense>
      ) : (
        <p className="p-6 font-mono text-xs text-ink-faint">loading api reference…</p>
      )}
    </main>
  )
}
