# UI design system

The interface is light and neobrutalist: a paper canvas with a faint dot grid, charcoal 2px borders, hard offset shadows with no blur, flat saturated fills, chunky headings, and monospace data. Things that can be pressed sit on a shadow, lift when hovered, and sink into it when clicked. The decision and the alternatives are in [ADR-0020](./adr/0020-adopt-a-light-neobrutalist-interface.md).

The palette is pinshelf's own, inverted: the warm charcoal that used to be the canvas is now the ink and every border, the off-white paper is now the canvas, and brass, turned up to a brass yellow, is the primary fill. Steel stays on the pin. Nothing in the UI uses a raw neutral grey.

## Source of truth

`apps/web/src/styles/app.css` holds everything: the fonts, design tokens in `@theme`, reusable classes in `@layer components`. Components use those tokens and classes; they do not define colours, fonts, shadows, or radii locally.

## Tokens

| Token           | Value          | Role                                                           |
| --------------- | -------------- | -------------------------------------------------------------- |
| `canvas`        | `#f4eee1`      | Page background, paper                                         |
| `surface`       | `#fffcf5`      | Cards, panels, inputs, buttons                                 |
| `surface-hover` | `#ece4d4`      | Wells, inset areas, hover fills                                |
| `line`          | `#131110`      | Every structural border and every hard shadow                  |
| `line-soft`     | `#d8cebb`      | Hairline dividers inside a single card                         |
| `ink`           | `#131110`      | Primary text                                                   |
| `ink-muted`     | `#463e36`      | Secondary text                                                 |
| `ink-faint`     | `#6b6155`      | Metadata, placeholders — neutral surfaces only                 |
| `accent`        | `#fcc93a`      | Brass yellow fill: primary actions, active and selected states |
| `accent-ink`    | `#7a5800`      | Brass as text, when it must be brass                           |
| `pink`          | `#ffa3c8`      | Fill: personal annotation — highlights, notes, tag management  |
| `sky`           | `#92d2ff`      | Fill: information and access — tokens, sessions, preview, docs |
| `mint`          | `#9be8b4`      | Fill: safety and success — two-factor, backups, restore        |
| `lilac`         | `#c8b6ff`      | Fill: AI — smart search, ask, the toolbox                      |
| `coral`         | `#ff8f7d`      | Fill: danger — delete forever, revoke, error notices           |
| `ok`            | `#17703a`      | Success text                                                   |
| `warn`          | `#a84b06`      | Non-fatal problems (metadata fetch failed)                     |
| `danger`        | `#b8271b`      | Error text                                                     |
| `brass`         | `#c9a227`      | The mark's shelf only                                          |
| `steel`         | `#b9bec6`      | The mark's pin only                                            |
| `--font-sans`   | Space Grotesk  | Content: titles, headings, descriptions, notes                 |
| `--font-mono`   | JetBrains Mono | Data: urls, hosts, counts, tags, statuses, nav, wordmark       |

Shadows are a scale of offsets, all in `line`: `shadow-hard-xs` (2px), `shadow-hard-sm` (3px), `shadow-hard` (4px), `shadow-hard-lg` (6px), `shadow-hard-xl` (8px).

Tailwind turns each token into utilities: `bg-sky`, `border-line`, `text-ink-muted`, `shadow-hard-lg`, and so on. Tags take their fill from `tagTone()` in `apps/web/src/lib/tag-tone.ts`, so a tag is the same colour everywhere.

### Contrast

Every text token — `ink`, `ink-muted`, `ink-faint`, `accent-ink`, `ok`, `warn`, `danger` — is at least 4.5:1 on `canvas`, `surface`, and `surface-hover` (`ink-faint` on `surface-hover` is the floor at 4.79:1). On the pop fills only `ink` and `ink-muted` qualify; `ink` is at least 8.5:1 on each of them. `accent` is never a text colour. The site runs the same check in `site/scripts/check-contrast.mjs`.

## The mark

The mark is the lowercase `p` of the wordmark drawn as a pushpin, its needle driven through a shelf. The pin — bowl and needle — is `steel`; the shelf is `brass`.

Steel on paper is under 2:1, so inside the interface the mark always sits on an `ink` plate: a rounded square, corner radius 26 on the 120 grid, with the mark scaled to 78% and centred — the same plate the favicon has always used. `Logo` draws the plate itself; the one exception is `mono`, below.

There are two cuts of the same silhouette. The full cut is for 32px and up. Below 32px the compact cut takes over: thicker shelf, heavier bowl, wider needle, same outline. `Logo.tsx` switches on the size the mark renders at inside its plate, so callers never choose a cut.

The geometry lives in three places on purpose, none depending on the others:

- `apps/web/src/components/Logo.tsx` — both cuts and the plate, coloured with token utilities (`fill-ink`, `fill-brass`, `fill-steel`, `stroke-steel`)
- `apps/web/public/favicon.svg` — compact cut on the plate
- `apps/web/scripts/generate-icons.mjs` (`make icons`) — PWA PNGs, full cut

The PWA icons for Android and desktop use the full cut on a transparent canvas, where the platform supplies the background. The favicon, the apple-touch icon, and the extension toolbar icons carry the plate, because their background is unknown.

When rasterising, the bowl is an annulus rather than a stroked path: full cut, centre `(64, 46)`, radii `12.5`–`27.5`; compact cut, centre `(66, 46)`, radii `11.5`–`28.5`. Everything else is a rounded rect and a five-point polygon. For maskable icons, scale the mark to about 80% and centre it so a circular crop is safe.

Change the pin in one place and you change it in all three, plus the extension popup and `docs/brand/`.

### The wordmark

`pinshelf`, lowercase, in `--font-mono` at weight 500 with `-0.055em` tracking. In the app it is live text next to `<Logo />`, not an asset. The interface now self-hosts JetBrains Mono, the face the flat assets are outlined from, so the live wordmark and the brand files match.

## Brand assets

`docs/brand/` holds the flat assets for surfaces we do not own: GitHub, social cards, package registries, avatars.

| File              | Use                                                        |
| ----------------- | ---------------------------------------------------------- |
| `logo-dark.svg`   | Lockup for dark backgrounds; wordmark outlined to paths    |
| `logo-light.svg`  | Same lockup with the pin in `ink`, for light backgrounds   |
| `mark.svg`        | Mark alone, dark backgrounds                               |
| `mark-light.svg`  | Mark alone, light backgrounds                              |
| `mark-plate.svg`  | Mark on its `ink` plate; avatars, npm, Docker Hub, Discord |
| `social-card.png` | 1200×630 for `og:image` and `twitter:image`                |

`make icons` also copies the lockup, the marks, the favicon, and the card into `site/public/assets`; the static site never keeps its own hand-edited copies.

Rules for these: a lockup always ships as a dark/light pair, chosen by the consumer. Where the consumer cannot choose — an org avatar, a registry listing — use the plate. Never place the transparent mark on an unknown background. The social card stays dark; the login page frames it like a poster.

In the README, let the reader's own theme pick:

```html
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/logo-dark.svg" />
    <img alt="pinshelf" src="docs/brand/logo-light.svg" width="420" />
  </picture>
</p>
```

## Layout

Every signed-in view is `<main className="page">`, then `<AppHeader />`, then `<PageHeading title="…" note="…">`, then the content. Both components live in `apps/web/src/components/AppHeader.tsx`. The header carries the mark, the wordmark, the full navigation, and sign out; the router marks the current link with `data-status="active"`, which `.nav-link` fills with `accent`. On phones the navigation scrolls sideways under the logo row; from `md` up the header is one sticky row.

Sections are cards: a `.panel` with a coloured `.panel-head` holding the section title, then a padded body. Rows inside a section are `.tile`s. The colour of a `.panel-head` follows the meanings in the token table, so the AI section is lilac wherever it appears.

## Component classes

| Class           | Use                                                                             |
| --------------- | ------------------------------------------------------------------------------- |
| `page`          | The `<main>` of a signed-in view: width, gutters, room for the floating buttons |
| `page-title`    | The big lowercase `h1` (via `PageHeading`)                                      |
| `section-title` | Section `h2`/`h3`                                                               |
| `label`         | Uppercase mono form label                                                       |
| `panel`         | Card: 2px border, `shadow-hard`, `rounded-lg`                                   |
| `panel-head`    | Coloured strip across the top of a panel; give it a `bg-*` fill                 |
| `tile`          | Row inside a section: 2px border, `shadow-hard-xs`                              |
| `well`          | Inset area inside a panel: grouped controls, generated codes, an AI answer      |
| `field`         | Input, textarea, select; focus is a hard shadow                                 |
| `btn`           | Secondary action, mono label; add a fill when it means something                |
| `btn-primary`   | The one main action of a form or section, `accent` fill                         |
| `btn-danger`    | Modifier for `btn` on actions that cannot be undone, `coral` fill               |
| `chip`          | Pill: tags (with `tagTone`), filters, counts                                    |
| `notice`        | Message that must be seen; give it a `bg-*` fill                                |
| `empty`         | Empty state, dashed border                                                      |
| `sticker`       | Small tilted `accent` badge for counts and one-off emphasis                     |
| `link`          | Inline text link with an `accent` underline                                     |
| `kbd`           | Keyboard key                                                                    |
| `nav-link`      | Header and tab links                                                            |
| `overlay`       | Full-screen `ink` scrim under a modal or drawer                                 |
| `dialog`        | Modal surface, `shadow-hard-xl`                                                 |
| `checkbox`      | Checkbox: `accent` fill with an `ink` tick when checked                         |

## Rules

1. **Light only.** Never add `dark:` variants. Emphasis comes from fill, weight, and depth, not from a second theme. Brand assets in `docs/brand/` still ship dark and light variants, because GitHub, social cards and registries render on backgrounds we do not control.
2. **Tokens, never raw values.** No hex codes, no `gray-500`, no inline styles for colour, radius, or shadow. If a value is missing, add a token. Files outside the Tailwind build — `favicon.svg`, `generate-icons.mjs`, the extension popup, the public share page (`routes/s.$token.ts`), the API reference theme in `routes/api-docs.tsx`, the two-factor QR colours, `docs/brand/`, and `site/` — cannot reference `@theme` and so carry literal hex that mirrors the tokens. Update them when a token changes.
3. **Colour means something.** `accent` is primary or current, `sky` is information and access, `mint` is safety and success, `lilac` is AI, `pink` is personal annotation, `coral` is danger. Fills are for surfaces and buttons; text uses the text tokens.
4. **Hard shadows, never soft ones.** Shadows come from the `shadow-hard-*` scale: no blur, no spread, always `line`. Something that can be pressed lifts on hover (translate up-left, larger shadow) and sinks on press (translate down-right, no shadow); the far edge of the shadow does not move.
5. **Borders are 2px and `line`.** `line-soft` is only for dividers inside a single card.
6. **Monospace means data.** Urls, hosts, counts, tags, statuses, navigation, and empty states are mono. Titles, descriptions, and notes are sans.
7. **Chrome is lowercase, forms are labelled.** Page titles and navigation read `collections`, `archive`, `sign out`. Form fields carry a `.label`.
8. **Hover reveals are desktop-only.** Row actions use `sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100` so touch devices keep them visible.
9. **Do not remove focus outlines.** The global `:focus-visible` rule in `app.css` is the accessibility floor; `.field` swaps it for a hard shadow, which is at least as visible.
10. **Reuse before adding.** If a pattern appears a third time, add a class to `@layer components` rather than repeating utility strings.
11. **The mark is not decoration.** Do not rotate it, recolour the needle, put it on a gradient, or rebuild it inline. Use `<Logo />`, or a file from `docs/brand/`. A bookmark with no favicon falls back to the mark at `ink-faint` with no plate, never at full colour — a list of them should not light up.

## Typography

Two self-hosted variable fonts, both under the SIL Open Font License, latin subset only: Space Grotesk for `--font-sans` and JetBrains Mono for `--font-mono`. The woff2 files and their licences sit in `apps/web/src/styles/fonts/`. `app.css` references them relatively, so Vite fingerprints them into `/assets/` (which the service worker caches), and `__root.tsx` preloads the same urls. Do not add a CDN font link. To add a script outside latin, add that subset next to the existing file with a `unicode-range`.

Flat brand assets must render identically on machines we do not control, so their wordmark is outlined to paths from JetBrains Mono Medium — no font is loaded at view time.

## The extension

The browser extension does not share the web build, so `apps/extension/entrypoints/popup/index.html` mirrors the tokens as literal hex, the hard-shadow scale, the `.label`, `.field`, `.btn`, `.btn-primary`, `.checkbox`, and `.notice` classes, and the `bg-*` fills it uses. Its `@font-face` rules point at the web app's woff2 files in `apps/web/src/styles/fonts/`, which Vite bundles into the extension, so there is still one copy of each font. The popup shows `apps/extension/public/mark.svg` on a CSS plate with the favicon's proportions, and the toolbar badge colours in `entrypoints/background.ts` are a third place that hard-codes token hex. Its toolbar icons come from the same `make icons` run that produces the PWA icons. Change these files together when a token, a class, or the pin changes. Same palette, same rules, no Tailwind in the extension bundle.

## Checking your change

Run `pnpm dev` and look at `/login`, `/`, `/bookmarks/$id`, `/archive`, `/collections`, `/tags`, `/insights`, and `/settings`, at desktop width and at 390px. Open the command palette (`cmd/ctrl + k`), the shortcut list (`?`), the toolbox, and a preview. There are no visual regression tests yet; add Playwright screenshots if the churn justifies them.

After a change to the pin, check it at 16px in a browser tab, at 30px in the app header, and as a PWA icon after `make icons` — small sizes are where it breaks, not large ones.

## Related

- [ADR-0020](./adr/0020-adopt-a-light-neobrutalist-interface.md) — why the interface is light and neobrutalist
- [ADR-0005](./adr/0005-ship-pwa-and-extension-before-native-shells.md) — client strategy, which decides where UI work lands
- [CONTRIBUTING.md](../CONTRIBUTING.md) — pull request expectations
