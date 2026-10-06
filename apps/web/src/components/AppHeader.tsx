import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Logo } from '~/components/Logo'
import { SignOut } from '~/components/SignOut'

const NAV = [
  { to: '/', label: 'shelf', exact: true },
  { to: '/archive', label: 'archive', exact: false },
  { to: '/collections', label: 'collections', exact: false },
  { to: '/tags', label: 'tags', exact: false },
  { to: '/insights', label: 'insights', exact: false },
  { to: '/settings', label: 'settings', exact: false },
] as const

/**
 * The bar across the top of every signed-in view: mark, wordmark, the full
 * navigation, sign out. The router marks the current link with
 * data-status="active", which `.nav-link` styles.
 */
export function AppHeader() {
  return (
    // Phones: logo and sign out share the first row, the nav scrolls sideways
    // under them. From md up it is one sticky row.
    <header className="panel z-30 flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 md:sticky md:top-3">
      <Link
        to="/"
        className="mr-auto flex items-center gap-2 rounded-md"
        aria-label="pinshelf home"
      >
        <Logo size={30} />
        <span className="font-mono text-lg font-medium tracking-[-0.055em]">
          pinshelf
        </span>
      </Link>
      <nav className="order-last -mx-3 flex w-[calc(100%+1.5rem)] items-center gap-0.5 overflow-x-auto px-2 py-1 md:order-none md:mx-0 md:w-auto md:overflow-visible md:p-0">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            activeOptions={{ exact: item.exact, includeSearch: false }}
            className="nav-link shrink-0"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <SignOut />
    </header>
  )
}

/** Big lowercase title under the header, with an optional note and actions. */
export function PageHeading({
  title,
  note,
  children,
}: {
  title: string
  note?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="page-title">{title}</h1>
        {note && <p className="font-mono text-xs text-ink-muted">{note}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
