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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-2">
        <Logo />
        <h1 className="text-lg font-medium">save to pinshelf</h1>
        <p className="font-mono text-xs text-ink-faint">
          {search.title ?? 'from a share sheet'}
        </p>
      </div>
      <AddBookmarkForm initialUrl={search.url ?? urlFrom(search.text)} />
      <a href="/" className="btn self-start">
        go to your shelf
      </a>
    </main>
  )
}
