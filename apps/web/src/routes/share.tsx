import { createFileRoute, redirect } from '@tanstack/react-router'
import { AddBookmarkForm } from '~/components/AddBookmarkForm'
import { Logo } from '~/components/Logo'
import { fetchSession } from '~/lib/session'

type ShareSearch = {
  url?: string
  text?: string
  title?: string
}

// Share targets hand over whatever the sending app has: sometimes a url, often
// just text with the link inside it.
function urlFrom(text: string | undefined): string {
  if (!text) return ''
  const match = text.match(/https?:\/\/\S+/)
  return match ? match[0] : text.trim()
}

export const Route = createFileRoute('/share')({
  validateSearch: (search: Record<string, unknown>): ShareSearch => ({
    url: typeof search.url === 'string' && search.url ? search.url : undefined,
    text: typeof search.text === 'string' && search.text ? search.text : undefined,
    title: typeof search.title === 'string' && search.title ? search.title : undefined,
  }),
  beforeLoad: async () => {
    const session = await fetchSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    return { session }
  },
  component: SharePage,
})

function SharePage() {
  const search = Route.useSearch()

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 sm:p-8">
      <div className="panel flex w-full max-w-md flex-col gap-5 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-2xl leading-none font-bold tracking-tight">
              save to pinshelf
            </h1>
            <p className="truncate font-mono text-xs text-ink-muted">
              {search.title ?? 'from a share sheet'}
            </p>
          </div>
        </div>
        <div className="rounded-lg border-2 border-line bg-accent p-3 shadow-hard-xs">
          <AddBookmarkForm onAccent initialUrl={search.url ?? urlFrom(search.text)} />
        </div>
        <a href="/" className="btn self-start px-3 py-1.5">
          go to your shelf
        </a>
      </div>
    </main>
  )
}
