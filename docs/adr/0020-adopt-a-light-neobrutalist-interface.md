# Adopt a light neobrutalist interface

- Status: accepted
- Date: 2026-10-06

## Context and Problem Statement

The first interface was dark, flat, and dense, modelled on developer-tool sites: 1px hairline borders, no shadows, small type, one brass accent. It was legible but anonymous — every surface looked like every other surface, the only emphasis available was a brighter border, and a personal bookmark shelf read like a terminal. The rule set in `docs/design.md` (dark only, borders over shadows, no box shadows anywhere) made any warmer direction impossible without replacing it. Which visual system should pinshelf commit to instead, and what has to change with it?

## Decision Drivers

- A recognisable identity for a personal tool, not a generic dark dashboard.
- Hierarchy that comes from form (fill, weight, depth), not only from text colour.
- WCAG AA text contrast on every surface, checked the same way the site already checks it.
- Keep the brand: the pushpin mark, the brass, the charcoal and paper palette.
- Stay cheap to maintain: one token file, a handful of component classes, no runtime theming.
- No new dependencies and no third-party requests (fonts are self-hosted).

## Considered Options

- Light neobrutalism: paper canvas, charcoal 2px borders, hard offset shadows, flat pop fills
- Dark neobrutalism: keep the charcoal canvas and add bright borders and coloured shadows
- Keep the dark minimal system and polish it

## Decision Outcome

Chosen option: "light neobrutalism", because it is the only option that changes how the product feels rather than how dark it is, and the brand palette inverts cleanly: the old canvas charcoal becomes ink and borders, the old paper ink becomes the canvas, and brass becomes the primary fill.

The system lives where the old one did. `apps/web/src/styles/app.css` holds the tokens (paper, ink, a brass-yellow accent plus pink, sky, mint, lilac and coral fills, separate text tokens for brass, ok, warn and danger), a hard-shadow scale with no blur, and the component classes (`page`, `panel`, `panel-head`, `tile`, `btn`, `btn-primary`, `btn-danger`, `field`, `chip`, `notice`, `empty`, `sticker`, `link`, `kbd`, `nav-link`, `overlay`, `dialog`, `checkbox`). Space Grotesk (sans) and JetBrains Mono (mono) are self-hosted as latin-subset woff2 files under `apps/web/src/styles/fonts`, so Vite fingerprints them into `/assets/`, which the service worker already caches. Every signed-in view shares `AppHeader` and `PageHeading`, so navigation is the same everywhere instead of a back link on each sub-page.

The mark does not change. Steel on paper is under 2:1, so in the interface the mark always sits on the same charcoal plate the favicon already uses; `Logo` draws it.

The extension popup, the public share page, the API reference theme, and the static site mirror the same tokens by hand, as they did before.

### Positive Consequences

- Clear hierarchy: primary actions are filled, cards have depth, colour encodes meaning (AI is lilac, danger is coral, safety is mint).
- Text tokens are all at least 4.5:1 on canvas, surface, and surface-hover; `ink` is at least 8.5:1 on every pop fill.
- One header and one page frame remove eight hand-written page headers.

### Negative Consequences

- Dark mode is gone. Anyone who preferred the dark interface loses it; adding it back means a second token set, not a toggle.
- Two font files (about 62 KB) are now part of the first load; they are preloaded and cached.
- Pop fills carry no text contrast for `ink-faint`, so that token is restricted to neutral surfaces.
- The social card and flat brand assets stay dark; the login page frames the card rather than matching it.

## Pros and Cons of the Options

### Light neobrutalism

- Good, because it is a distinctive, well-understood style that suits a personal, playful tool.
- Good, because depth and fill give hierarchy without relying on faint text.
- Bad, because it replaces every rule of the previous design document.

### Dark neobrutalism

- Good, because it keeps dark mode and the existing outside surfaces.
- Bad, because hard shadows and pop fills lose most of their contrast and charm on charcoal, so it reads as the old system with louder borders.

### Polish the dark minimal system

- Good, because it is the smallest change.
- Bad, because it keeps the problem: an interface with no voice.

## Links

- Refines [ADR-0005](0005-ship-pwa-and-extension-before-native-shells.md) — the PWA and extension carry the same system.
- [docs/design.md](../design.md) — the rules that implement this decision.
