import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { AppHeader, PageHeading } from '~/components/AppHeader'
import { insights } from '~/lib/library'
import { queryKeys } from '~/lib/queries'
import { fetchSession } from '~/lib/session'
import { tagTone } from '~/lib/tag-tone'

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

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`panel flex flex-col justify-between gap-3 p-4 ${tone}`}>
      <span className="label">{label}</span>
      <span className="text-4xl leading-none font-bold tracking-tight tabular-nums">
        {value}
      </span>
    </div>
  )
}

/** One horizontal bar, scaled against the largest value in its chart. */
function Bar({ value, max }: { value: number; max: number }) {
  return (
    <span className="flex min-w-0 flex-1 items-center">
      <span
        className="h-4 rounded-sm border-2 border-line bg-accent"
        style={{ width: `${Math.round((value / max) * 100)}%` }}
      />
    </span>
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
    <main className="page">
      <AppHeader />
      <PageHeading title="insights" note="what the shelf holds, and how well it keeps" />

      {/* Upkeep problems only light up coral when there is something to fix. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <Stat label="active" value={data.counts.active} tone="bg-accent" />
        <Stat label="archived" value={data.counts.archived} tone="bg-mint" />
        <Stat label="trashed" value={data.counts.trashed} tone="bg-pink" />
        <Stat
          label="broken links"
          value={data.upkeep.brokenLinks}
          tone={data.upkeep.brokenLinks > 0 ? 'bg-coral' : 'bg-surface'}
        />
        <Stat
          label="metadata failed"
          value={data.upkeep.metadataFailed}
          tone={data.upkeep.metadataFailed > 0 ? 'bg-coral' : 'bg-surface'}
        />
        <Stat label="page snapshots" value={data.upkeep.archivedPages} tone="bg-sky" />
      </div>

      <section className="panel">
        <div className="panel-head bg-accent">
          <h2 className="section-title">Saved per month</h2>
        </div>
        <ul className="flex flex-col gap-2 p-4">
          {data.perMonth.map((row) => (
            <li key={row.month} className="flex items-center gap-3">
              <span className="w-16 shrink-0 font-mono text-xs text-ink-muted">
                {row.month}
              </span>
              <Bar value={row.saved} max={maxMonth} />
              <span className="w-8 shrink-0 text-right font-mono text-xs font-bold tabular-nums">
                {row.saved}
              </span>
            </li>
          ))}
          {data.perMonth.length === 0 && (
            <li className="font-mono text-[11px] text-ink-faint">nothing saved yet</li>
          )}
        </ul>
      </section>

      <div className="grid items-start gap-6 md:grid-cols-2">
        <section className="panel">
          <div className="panel-head bg-sky">
            <h2 className="section-title">Top hosts</h2>
          </div>
          <ul className="flex flex-col gap-2 p-4">
            {data.topHosts.map((row) => (
              <li key={row.host} className="flex items-center gap-3">
                <span className="w-32 shrink-0 truncate font-mono text-xs text-ink-muted">
                  {row.host}
                </span>
                <Bar value={row.saved} max={maxHost} />
                <span className="w-8 shrink-0 text-right font-mono text-xs font-bold tabular-nums">
                  {row.saved}
                </span>
              </li>
            ))}
            {data.topHosts.length === 0 && (
              <li className="font-mono text-[11px] text-ink-faint">no hosts yet</li>
            )}
          </ul>
        </section>

        <section className="panel">
          <div className="panel-head bg-pink">
            <h2 className="section-title">Top tags</h2>
          </div>
          <div className="flex flex-wrap gap-2 p-4">
            {data.topTags.map((row) => (
              <span key={row.tag} className={`chip ${tagTone(row.tag)}`}>
                {row.tag} <span className="text-ink-muted">{row.saved}</span>
              </span>
            ))}
            {data.topTags.length === 0 && (
              <span className="font-mono text-[11px] text-ink-faint">no tags yet</span>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
