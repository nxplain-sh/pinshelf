# UI design system

The interface is dark, flat, and dense, in the spirit of developer-tool sites: [zed.dev](https://zed.dev), [opencode.ai](https://opencode.ai), [delta.dev](https://delta.dev), [ponytail.dev](https://ponytail.dev). Surfaces are separated by 1px borders rather than shadows, metadata is monospace, radii are small, and there is no light theme.

The palette is pinshelf's own: warm charcoal rather than pure black, off-white paper rather than pure white, brass for the shelf hardware, and steel for the pin. Nothing in the UI uses a raw neutral grey.

## Source of truth

`apps/web/src/styles/app.css` holds everything: design tokens in `@theme`, reusable classes in `@layer components`. Components use those tokens and classes; they do not define colours, fonts, or radii locally.

## Tokens

| Token           | Value             | Role                                                      |
| --------------- | ----------------- | --------------------------------------------------------- |
| `canvas`        | `#131110`         | Page background, warm charcoal                            |
| `surface`       | `#1a1715`         | Cards, panels, inputs                                     |
| `surface-hover` | `#221e1b`         | Chips and hover fills                                     |
| `line`          | `#2e2925`         | Default border                                            |
| `line-strong`   | `#4a423a`         | Hover and focus borders                                   |
| `ink`           | `#f2ece2`         | Primary text, off-white paper                             |
| `ink-muted`     | `#b3a99b`         | Secondary text                                            |
| `ink-faint`     | `#837a6d`         | Metadata, placeholders                                    |
| `accent`        | `#c9a227`         | Brass: selection, focus outline, active filters, emphasis |
| `steel`         | `#b9bec6`         | The pin: logo mark only                                   |
| `warn`          | `#e58a3a`         | Non-fatal problems (metadata fetch failed)                |
| `danger`        | `#d2604f`         | Errors                                                    |
| `--font-sans`   | system stack      | Content: titles, descriptions, notes                      |
| `--font-mono`   | system mono stack | Data: urls, hosts, counts, tags, statuses, nav, wordmark  |

Tailwind turns each colour token into utilities: `bg-canvas`, `border-line`, `text-ink-muted`, `hover:border-line-strong`, `border-accent/50`, and so on.

## The mark

The mark is the lowercase `p` of the wordmark drawn as a pushpin, its needle driven through a shelf. The pin — bowl and needle — is `steel`; the shelf is `accent`. The mark never uses `ink`, so it does not compete with text sitting beside it.

There are two cuts of the same silhouette. The full cut is for 32px and up. Below 32px the compact cut takes over: thicker shelf, heavier bowl, wider needle, same outline. `Logo.tsx` switches on its `size` prop, so callers never choose a cut.

The geometry lives in three places on purpose, none depending on the others:

- `apps/web/src/components/Logo.tsx` — both cuts, coloured with token utilities (`fill-accent`, `fill-steel`, `stroke-steel`)
- `apps/web/public/favicon.svg` — compact cut on a `canvas` plate
- `apps/web/scripts/generate-icons.mjs` (`make icons`) — PWA PNGs, full cut

The favicon carries a plate because a browser tab may be light, and `steel` on white is roughly 2:1. The same reasoning applies to the apple-touch icon (iOS composites it onto an unknown background) and to the extension toolbar icons, so those three use the plate too. The PWA icons for Android and desktop use the full cut on a transparent canvas, where the platform supplies the background. Everything inside the app lands on our own surfaces and stays transparent.

When rasterising, the bowl is an annulus rather than a stroked path: full cut, centre `(64, 46)`, radii `12.5`–`27.5`; compact cut, centre `(66, 46)`, radii `11.5`–`28.5`. Everything else is a rounded rect and a five-point polygon. For maskable icons, scale the mark to about 80% and centre it so a circular crop is safe.

Change the pin in one place and you change it in all three, plus the extension popup and `docs/brand/`.

### The wordmark

`pinshelf`, lowercase, in `--font-mono` at weight 500 with `-0.055em` tracking. In the app it is live text next to `<Logo />`, not an asset — nothing to keep in sync, no request, no layout shift.

## Brand assets

`docs/brand/` holds the flat assets for surfaces we do not own: GitHub, social cards, package registries, avatars.

| File              | Use                                                         |
| ----------------- | ----------------------------------------------------------- |
| `logo-dark.svg`   | Lockup for dark backgrounds; wordmark outlined to paths     |
| `logo-light.svg`  | Same lockup with the pin in `canvas`, for light backgrounds |
| `mark.svg`        | Mark alone, dark backgrounds                                |
| `mark-light.svg`  | Mark alone, light backgrounds                               |
| `mark-plate.svg`  | Mark on a `canvas` plate; avatars, npm, Docker Hub, Discord |
| `social-card.png` | 1200×630 for `og:image` and `twitter:image`                 |

`make icons` also copies the lockup, the marks, the favicon, and the card into `site/public/assets`; the static site never keeps its own hand-edited copies.

Rules for these: a lockup always ships as a dark/light pair, chosen by the consumer. Where the consumer cannot choose — an org avatar, a registry listing — use the plate. Never place the transparent mark on an unknown background.

In the README, let the reader's own theme pick:

```html
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/logo-dark.svg" />
    <img alt="pinshelf" src="docs/brand/logo-light.svg" width="420" />
  </picture>
</p>
```

## Component classes

| Class         | Use                                               |
| ------------- | ------------------------------------------------- |
| `panel`       | Bordered surface block (bulk bar, collection row) |
| `field`       | Input, textarea, select                           |
| `btn`         | Secondary action, mono lowercase label            |
| `btn-primary` | Primary action, inverted fill                     |
| `chip`        | Tag and filter chip                               |
| `label`       | Uppercase mono form label                         |

## Rules

1. **Dark only.** Never add `dark:` variants or light-mode palette colours. If something needs to stand out, brighten the border or the text, do not add a background. This governs the interface. Brand assets in `docs/brand/` are the one exception: they ship in dark and light variants because GitHub, social cards and registries render on backgrounds we do not control.
2. **Tokens, never raw values.** No hex codes, no `gray-500`, no inline styles for colour or radius. If a value is missing, add a token. Files outside the Tailwind build — `favicon.svg`, `generate-icons.mjs`, the extension popup, `docs/brand/` — cannot reference `@theme` and so carry literal hex that mirrors the tokens. Update them when a token changes.
3. **Monospace means data.** Urls, hosts, counts, tags, statuses, navigation, and empty states are mono. Titles, descriptions, and notes are sans.
4. **Borders over shadows.** A surface at rest has `border-line`; on hover it becomes `border-line-strong`. No box shadows anywhere.
5. **Chrome is lowercase, forms are labelled.** Navigation and status text read `collections`, `trash`, `sign out`. Form fields carry a `.label`.
6. **Hover reveals are desktop-only.** Row actions use `sm:opacity-0 sm:group-hover:opacity-100` so touch devices keep them visible.
7. **Do not remove focus outlines.** The global `:focus-visible` rule in `app.css` is the accessibility floor.
8. **Reuse before adding.** If a pattern appears a third time, add a class to `@layer components` rather than repeating utility strings.
9. **The mark is not decoration.** Do not rotate it, recolour the needle, put it on a gradient, or rebuild it inline. Use `<Logo />`, or a file from `docs/brand/`. A page with no favicon falls back to the mark at `ink-faint`, never at full brass — a list of them should not light up.

## Typography

System font stacks are deliberate: no webfont request, no layout shift, no dependency. To move to a custom typeface, self-host one woff2 in `apps/web/public`, add an `@font-face` in `app.css`, and point `--font-sans` or `--font-mono` at it. Do not add a CDN font link.

Flat brand assets are the exception, because they must render identically on machines we do not control. Their wordmark is outlined to paths from JetBrains Mono Medium (OFL) — no font is loaded at view time. The in-app wordmark stays live text in `--font-mono`, so the two are near but not letter-identical. If that ever matters, self-host JetBrains Mono and point `--font-mono` at it rather than un-outlining the assets.

## The extension

The browser extension does not share the web build, so it mirrors the tokens, the mark, and the `.field`, `.btn`, `.btn-primary`, and `.label` classes in `apps/extension/entrypoints/popup/index.html`. The popup renders the mark from `apps/extension/public/mark.svg`, and its toolbar icons come from the same `make icons` run that produces the PWA icons. Change both files together when a token, a class, or the pin changes. Same palette, same rules, no Tailwind in the extension bundle.

## Checking your change

Run `pnpm dev` and look at `/login`, `/`, `/bookmarks/$id`, `/trash`, `/collections`, and `/settings`. There are no visual regression tests yet; add Playwright screenshots if the churn justifies them.

After a change to the pin, check it at 16px in a browser tab, at 22px in the app header, and as a PWA icon after `make icons` — small sizes are where it breaks, not large ones.

## Related

- [ADR-0005](./adr/0005-ship-pwa-and-extension-before-native-shells.md) — client strategy, which decides where UI work lands
- [CONTRIBUTING.md](../CONTRIBUTING.md) — pull request expectations
