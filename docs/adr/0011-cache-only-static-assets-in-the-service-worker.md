# Cache only static assets in the service worker

- Status: accepted
- Date: 2026-09-20

## Context and Problem Statement

pinshelf should install as a PWA on Android, desktop, and iOS home screens, which needs a web app manifest, icons, and a service worker for installability and repeat-load speed. The service worker is also the component most likely to serve a user something stale or wrong: cached HTML could show a signed-out page, cached API responses could show bookmarks that were deleted, and a buggy cache can outlive the deploy that fixed it. What should the service worker cache?

## Decision Drivers

- Installability on the platforms named in [ADR-0005](0005-ship-pwa-and-extension-before-native-shells.md).
- Never serve stale auth state or stale bookmark data.
- No new dependency if the job can be done in a few dozen lines.
- Self-hosters deploy rarely; cache invalidation must be trivially explainable.

## Considered Options

- No service worker at all
- Hand-written service worker caching immutable static assets only
- `vite-plugin-pwa` with Workbox precache and runtime caching
- Full offline support: cached app shell plus cached API responses

## Decision Outcome

Chosen option: "Hand-written service worker caching immutable static assets only", because installability and fast repeat loads come from caching hashed build assets, while every risky response class stays on the network.

The worker caches `/assets/*`, `/icons/*`, `/favicon.svg`, and `/manifest.webmanifest` with cache-first semantics. It deliberately does not intercept navigations (`request.mode === 'navigate'`) or anything under `/api/`, so HTML and data are always fetched live. It is registered only in production builds (`import.meta.env.PROD`), because a cache-first worker in dev fights Vite's hot reload. Icons are generated from the same pin geometry as the logo by `apps/web/scripts/generate-icons.mjs`, which rasterizes shapes and writes PNGs using Node's zlib; no image dependency, and `make icons` regenerates them.

### Positive Consequences

- Installable on Android, desktop, and iOS (with `apple-touch-icon`), and repeat visits skip re-downloading hashed assets.
- A stale cache can never expose another session or deleted data, because no HTML or API response is cached.
- No Workbox or plugin dependency; the whole behaviour fits in one reviewable file.
- Bumping `CACHE` in `sw.js` is the entire invalidation story.

### Negative Consequences

- No offline reading: with no network, the app shell loads but the bookmark list does not.
- No precache manifest, so the first visit still downloads everything; the cache only helps from the second visit.
- Cache-first on hashed assets is only safe while filenames stay content-addressed; a future non-hashed asset under `/assets/` would need an explicit exclusion.
- iOS may evict the cache; it is a best-effort optimization, not a storage guarantee.

### Revisit trigger

Add cached API reads (with explicit staleness indicators in the UI) when offline reading of bookmarks is actually wanted. Adopt `vite-plugin-pwa` if precaching, update prompts, or background sync become requirements that outweigh one dependency.

## Pros and Cons of the Options

### No service worker

- Good, because nothing can go stale and there is no cache to debug.
- Bad, because installability and repeat-load performance suffer, and the manifest alone gives a weaker PWA experience.

### Static-assets-only, hand-written

- Good, because risk-free caching with no dependency.
- Bad, because no offline data and no precache manifest.

### `vite-plugin-pwa` with Workbox

- Good, because precache manifests, update flows, and offline fallbacks come built in.
- Bad, because it adds Workbox and build plugin surface for a feature set the app does not yet use.

### Full offline with cached API

- Good, because bookmarks would be readable offline.
- Bad, because it introduces stale-data UX problems (deleted bookmarks reappearing, edits lost) that need conflict handling to be honest.

## Links

- [MDN: service worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web app manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- Related: [ADR-0005](0005-ship-pwa-and-extension-before-native-shells.md)
