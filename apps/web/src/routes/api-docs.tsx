import { createFileRoute, redirect } from '@tanstack/react-router'
import { Suspense, lazy, useEffect, useState } from 'react'
import type { ComponentProps } from 'react'
import { AppHeader, PageHeading } from '~/components/AppHeader'
import { buildOpenApiDocument } from '~/lib/openapi'
import { fetchSession } from '~/lib/session'

const ApiReference = lazy(async () => {
  // Scalar's layout lives in its own stylesheet; without it the reference
  // renders as an unstyled document. Loaded with the chunk so it never reaches
  // the app's initial CSS, and inlined into a <style> that unmounts with this
  // page: as a global stylesheet it outlived the visit and its body rule
  // (`background-color: var(--scalar-background-1)`, white in light mode)
  // repainted every page after it.
  const [{ default: css }, module] = await Promise.all([
    import('@scalar/api-reference-react/style.css?inline'),
    import('@scalar/api-reference-react'),
  ])
  const Reference = module.ApiReferenceReact
  return {
    default: (props: ComponentProps<typeof Reference>) => (
      <>
        <style>{css}</style>
        <Reference {...props} />
      </>
    ),
  }
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
      {/* Same frame as every other page for the header; Scalar takes the full width below. */}
      <div className="page min-h-0 pb-6">
        <AppHeader />
        <PageHeading title="api reference" />
      </div>

      <div className="flex-1 border-t-2 border-line bg-surface">
        {mounted ? (
          <Suspense
            fallback={
              <p className="p-6 font-mono text-xs text-ink-muted">
                loading api reference…
              </p>
            }
          >
            <ApiReference
              configuration={{
                content: buildOpenApiDocument(window.location.origin),
                theme: 'default',
                darkMode: false,
                forceDarkModeState: 'light',
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
                // Scalar ships its own palette; point its variables at the app's
                // tokens (literal hex: Scalar's stylesheet cannot see @theme) so
                // the reference reads as part of the paper interface: paper
                // sidebar, near-white content, charcoal text, brass for the
                // active item, and the app's two typefaces.
                customCss: [
                  ':root, .light-mode {',
                  "  --scalar-font: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;",
                  "  --scalar-font-code: 'JetBrains Mono', ui-monospace, Menlo, monospace;",
                  '  --scalar-color-accent: #7a5800;',
                  '  --scalar-background-1: #fffcf5;',
                  '  --scalar-background-2: #f4eee1;',
                  '  --scalar-background-3: #ece4d4;',
                  '  --scalar-background-accent: #fcc93a33;',
                  '  --scalar-color-1: #131110;',
                  '  --scalar-color-2: #463e36;',
                  '  --scalar-color-3: #6b6155;',
                  '  --scalar-border-color: #d8cebb;',
                  // Method badges: the app's status colours, readable on paper.
                  '  --scalar-color-green: #17703a;',
                  '  --scalar-color-red: #b8271b;',
                  '  --scalar-color-orange: #a84b06;',
                  '  --scalar-color-yellow: #7a5800;',
                  '  --scalar-button-1: #131110;',
                  '  --scalar-button-1-hover: #463e36;',
                  '  --scalar-button-1-color: #fffcf5;',
                  '  --scalar-radius: 6px;',
                  '  --scalar-radius-lg: 10px;',
                  '  --scalar-sidebar-background-1: #f4eee1;',
                  '  --scalar-sidebar-item-hover-background: #ece4d4;',
                  '  --scalar-sidebar-item-active-background: #fcc93a;',
                  '  --scalar-sidebar-color-active: #131110;',
                  '  --scalar-sidebar-search-background: #fffcf5;',
                  '  --scalar-sidebar-search-border-color: #131110;',
                  '}',
                  // Scalar paints the body with background-1; keep the paper
                  // canvas around the header, the wrapper below is the sheet.
                  'body.light-mode { background-color: #f4eee1; }',
                  // Scalar's agent button needs a Scalar account to do anything;
                  // on a self-hosted reference it is a dead end. Selector is
                  // scoped to the button so the search field survives.
                  'button.bg-sidebar-b-search.whitespace-nowrap { display: none !important; }',
                ].join('\n'),
              }}
            />
          </Suspense>
        ) : (
          <p className="p-6 font-mono text-xs text-ink-muted">loading api reference…</p>
        )}
      </div>
    </main>
  )
}
