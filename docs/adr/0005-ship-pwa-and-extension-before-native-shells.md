# Ship a PWA and a browser extension before native shells

- Status: accepted
- Date: 2026-09-20

## Context and Problem Statement

pinshelf is wanted on the web, on Android and iOS, on the desktop, and inside the browser where bookmarking actually happens. Four platforms imply four release pipelines, four review queues, and four chances for the product to drift. Which clients are worth building before there is evidence that the fourth one is needed?

## Decision Drivers

- The primary flow is "save the page I am looking at", which is a browser problem before it is a mobile problem.
- Release and review cost per platform, especially Apple's.
- One codebase to keep coherent while the product is still finding its shape.
- PWA installability covers Android, desktop, and iOS home screens without an app store.

## Considered Options

- Installable PWA plus a browser extension, and nothing else
- PWA plus extension plus Capacitor wrappers for iOS and Android
- PWA plus extension plus Tauri for desktop
- Native clients from day one (Swift, Kotlin, or React Native)

## Decision Outcome

Chosen option: "PWA plus a browser extension", because together they cover every platform that can install a PWA, and the extension covers the save-from-page flow, which is the feature that makes a bookmark manager get used. Native shells stay on the roadmap behind explicit triggers.

The extension is built with WXT so Chrome and Firefox come from one source. Native shells arrive when push notifications for saved items or an iOS share target are demanded; both are capabilities WebKit does not offer to PWAs.

### Positive Consequences

- One web codebase plus one extension codebase to maintain in v1.
- Shipped instantly, no store review latency.
- The extension reuses the REST API that the audience of power users eventually wants anyway.

### Negative Consequences

- iOS cannot use a PWA as a share target, so saving on iPhone is manual paste or a Shortcut in v1. This is a real product gap, accepted knowingly.
- iOS PWA storage can be evicted by the system, so offline caching must be treated as best-effort.
- Adding Capacitor or Tauri later means a new release pipeline that cannot be validated until it exists.

## Pros and Cons of the Options

### PWA plus browser extension

- Good, because installability covers Android, desktop, and iOS without stores.
- Good, because the extension is where saving belongs.
- Bad, because of the iOS share-target gap.

### PWA plus extension plus Capacitor

- Good, because it unlocks native share targets and push on both mobile platforms.
- Bad, because it adds two release pipelines, Apple review, and a plugin ecosystem to debug, for features not yet demanded.

### PWA plus extension plus Tauri

- Good, because desktop gets a smaller binary than Electron and can be deeply integrated later.
- Bad, because the PWA already installs on desktop; Tauri is a solution to a problem that has not been observed.

### Native clients from day one

- Good, because the best possible platform feel.
- Bad, because three codebases for a v1 with one user.

## Links

- [WXT documentation](https://wxt.dev/)
- Related: [ADR-0002](0002-build-on-tanstack-start-and-cloudflare-workers.md)
