type LogoProps = {
  /** Rendered edge length in px. Below 32 the compact cut is used. */
  size?: number
  className?: string
  /**
   * Accessible name. Omit when the mark sits next to the wordmark —
   * it is decorative there and gets aria-hidden instead.
   */
  title?: string
  /**
   * Draw the whole mark in `ink-faint`, with no plate. Used where the mark
   * stands in for a missing favicon: a list of them must not light up
   * (docs/design.md rule 9).
   */
  mono?: boolean
}

/**
 * The pinshelf mark: the lowercase p of the wordmark drawn as a pushpin,
 * its needle driven through a shelf.
 *
 * Pin (bowl + needle) is `steel`, shelf is `brass`, and both sit on an `ink`
 * plate — the interface is paper, and steel on paper is under 2:1. The plate
 * and its geometry are the favicon's, so the tab and the header match.
 *
 * Geometry is duplicated in public/favicon.svg and scripts/generate-icons.mjs
 * on purpose, so neither has a runtime dependency on this file. Change all
 * three together.
 */
export function Logo({ size = 24, className, title, mono = false }: LogoProps) {
  // The plate shrinks the mark to 78%; pick the cut for the size it renders at.
  const compact = (mono ? size : size * 0.78) < 32
  const pin = mono ? 'fill-ink-faint' : 'fill-steel'
  const shelf = mono ? 'fill-ink-faint' : 'fill-brass'
  const bowl = mono ? 'stroke-ink-faint' : 'stroke-steel'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {!mono && <rect width="120" height="120" rx="26" className="fill-ink" />}
      <g transform={mono ? undefined : 'translate(13.2 13.2) scale(0.78)'}>
        {compact ? (
          <>
            <rect x="12" y="78" width="96" height="14" rx="7" className={shelf} />
            <circle
              cx="66"
              cy="46"
              r="20"
              fill="none"
              strokeWidth="17"
              className={bowl}
            />
            <path d="M30 14 H48 V86 L39 104 L30 86 Z" className={pin} />
          </>
        ) : (
          <>
            <rect x="16" y="80" width="88" height="11" rx="5.5" className={shelf} />
            <circle
              cx="64"
              cy="46"
              r="20"
              fill="none"
              strokeWidth="15"
              className={bowl}
            />
            <path d="M32 16 H45 V88 L38.5 102 L32 88 Z" className={pin} />
          </>
        )}
      </g>
    </svg>
  )
}

export default Logo
