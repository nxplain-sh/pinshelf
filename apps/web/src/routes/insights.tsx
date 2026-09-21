import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { SignOut } from '~/components/SignOut'
import { insights } from '~/lib/library'
import { queryKeys } from '~/lib/queries'
import { fetchSession } from '~/lib/session'

export const Route = createFileRoute('/insights')({
  beforeLoad: async () => {
    const session = await fetchSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    return { session }
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: queryKeys.insights,
      queryFn: () => insights(),
    })
  },
  component: InsightsPage,
})

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel flex flex-col gap-1 p-3">
      <span className="font-mono text-[11px] text-ink-faint">{label}</span>
      <span className="text-lg font-medium">{value}</span>
    </div>
  )
}

function InsightsPage() {
  const { data } = useSuspenseQuery({
    queryKey: queryKeys.insights,
    queryFn: () => insights(),
  })

  const maxMonth = Math.max(1, ...data.perMonth.map((row) => row.saved))
  const maxHost = Math.max(1, ...data.topHosts.map((row) => row.saved))

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-5 p-6">
      <header className="flex items-center justify-between border-b border-line pb-4">
        <Link
          to="/"
          className="font-mono text-xs text-ink-muted transition-colors hover:text-ink"
        >
          ← pinshelf
        </Link>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-ink-faint">insights</span>
          <SignOut />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="active" value={data.counts.active} />
        <Stat label="archived" value={data.counts.archived} />
        <Stat label="trashed" value={data.counts.trashed} />
        <Stat label="broken links" value={data.upkeep.brokenLinks} />
        <Stat label="metadata failed" value={data.upkeep.metadataFailed} />
        <Stat label="page snapshots" value={data.upkeep.archivedPages} />
      </div>

      <section className="flex flex-col gap-2 border-t border-line pt-5">
        <h2 className="text-sm font-medium">Saved per month</h2>
        <ul className="flex flex-col gap-1.5">
          {data.perMonth.map((row) => (
            <li key={row.month} className="flex items-center gap-3">
              <span className="w-16 font-mono text-[11px] text-ink-faint">
                {row.month}
              </span>
              <span
                className="h-2 rounded-sm bg-accent"
                style={{ width: `${Math.round((row.saved / maxMonth) * 100)}%` }}
              />
              <span className="font-mono text-[11px] text-ink-muted">{row.saved}</span>
            </li>
          ))}
          {data.perMonth.length === 0 && (
            <li className="font-mono text-[11px] text-ink-faint">nothing saved yet</li>
          )}
        </ul>
      </section>

      <section className="flex flex-col gap-2 border-t border-line pt-5">
        <h2 className="text-sm font-medium">Top hosts</h2>
        <ul className="flex flex-col gap-1.5">
          {data.topHosts.map((row) => (
            <li key={row.host} className="flex items-center gap-3">
              <span className="w-48 truncate font-mono text-[11px] text-ink-muted">
                {row.host}
              </span>
              <span
                className="h-2 rounded-sm bg-accent"
                style={{ width: `${Math.round((row.saved / maxHost) * 100)}%` }}
              />
              <span className="font-mono text-[11px] text-ink-faint">{row.saved}</span>
            </li>
          ))}
          {data.topHosts.length === 0 && (
            <li className="font-mono text-[11px] text-ink-faint">no hosts yet</li>
          )}
        </ul>
      </section>

      <section className="flex flex-col gap-2 border-t border-line pt-5">
        <h2 className="text-sm font-medium">Top tags</h2>
        <div className="flex flex-wrap gap-1.5">
          {data.topTags.map((row) => (
            <span key={row.tag} className="chip">
              {row.tag} {row.saved}
            </span>
          ))}
          {data.topTags.length === 0 && (
            <span className="font-mono text-[11px] text-ink-faint">no tags yet</span>
          )}
        </div>
      </section>
    </main>
  )
}
