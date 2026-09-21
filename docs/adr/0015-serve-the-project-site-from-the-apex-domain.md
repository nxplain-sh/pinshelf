# Serve the project site from the apex domain as static assets

- Status: accepted
- Date: 2026-09-20

## Context and Problem Statement

pinshelf has no public face: the README is the only place that explains what the app is and how to install it. The project needs a landing page and install documentation at `pinshelf.app`. But ADR-0002 wired `pinshelf.app` as the app's own custom domain, and the extension defaults to that origin for its API calls, so the hostname cannot be handed to a site without deciding where the app goes. Nothing is deployed yet, and the extension is unpublished, which makes this the cheapest moment to split the hostnames.

## Decision Drivers

- No second vendor or account: the domain, DNS, TLS, and deploy credentials already live in Cloudflare.
- The site must not drift from the app: same palette, same tokens, same mark, generated from one place.
- A handful of static pages does not justify a framework, a bundler, or a docs generator with its own content tree.
- Moving the app must not break the extension's stored API base URL or its host permissions.
- The site must be readable and navigable with JavaScript off, and must make no third-party requests.

## Considered Options

- Apex serves the static site as Workers Static Assets; the app moves to `app.pinshelf.app`
- Apex stays the app; the site lives at `docs.pinshelf.app` or `www`
- Site and app share one Worker, split by path
- GitHub Pages for the site
- Cloudflare Pages for the site
- A docs generator (Astro Starlight, Docusaurus, VitePress) instead of hand-written HTML

## Decision Outcome

Chosen option: "Apex serves the static site as Workers Static Assets; the app moves to `app.pinshelf.app`", because it keeps the marketing surface at the conventional hostname, adds no vendor, and matches Cloudflare's own recommendation to use Workers rather than Pages for new static sites.

The site is `site/`: hand-written HTML, CSS, and a small `site.js`, deployed as an assets-only Worker (`pinshelf-site`) with `assets.directory` pointed at `site/public` and a `custom_domain` route on the apex. No `main` script, no build step. The app keeps its Worker and moves to its own `custom_domain` route; `BETTER_AUTH_URL`, the extension's `DEFAULT_API_BASE_URL` and `host_permissions`, and the metadata fetcher's user agent all follow.

Brand files are generated: `make icons` already owns `docs/brand/`, and now also copies the lockup, marks, favicon, and social card into `site/public/assets`. Design tokens are duplicated into `site/public/styles.css` because the site has no bundler to import from `apps/web/src/styles/app.css`; `site/scripts/check-contrast.mjs` runs in `make check` and fails if any token the site renders as text drops below 4.5:1. `--ink-faint` is reserved for non-text so it only has to clear 3:1.

### Positive Consequences

- One provider, one set of credentials, one CLI; TLS and DNS are automatic for both hostnames.
- The site is a folder of files: reviewable in a diff, no dependency tree, no build to break.
- The extension's API origin is fixed before its first publish, so no permission change is ever needed.
- The mark, the social card, and the favicon cannot drift from the app: one script generates all copies.
- Zero off-origin requests; page weight stays under 50KB without the social card.

### Negative Consequences

- Two deploys (`make deploy`, `make site-deploy`) instead of one; there is no push-to-deploy workflow.
- The token definitions exist twice (app and site) and are only kept honest by the contrast check, not by a shared import.
- The install docs are hand-written and will drift from the README unless they are updated together.
- There is no search, no versioning, and no previous/next navigation on the docs page.
- The site Worker is a second Cloudflare resource to keep named and routed correctly.
- Docs pages beyond `install` are stubs; a generator becomes the better answer if the docs grow.

### Revisit trigger

Adopt a docs generator when the install page stops being the only page that needs real content, or when search and versioning are requested. Revisit the apex split if same-origin assumptions appear (cookies shared between marketing and app, CORS between the two hostnames, or a desire to preview the site on `workers.dev` before DNS is ready).

## Pros and Cons of the Options

### Apex site, app on a subdomain (chosen)

- Good, because the conventional layout puts the project at the apex and the product on `app.`.
- Good, because it costs one extra route and four small edits today, and nothing after the extension ships.
- Bad, because every existing `pinshelf.app` reference in code and docs has to move.

### Site on a subdomain, app stays at the apex

- Good, because nothing in the app or extension changes.
- Bad, because the marketing site lands at `www.` or `docs.`, which reads as an afterthought, and the apex still serves a login screen to first-time visitors.

### One Worker split by path

- Good, because everything is same-origin and one deploy.
- Bad, because TanStack Start would need a base path, the asset directories would have to merge at build time, and the app's auth and bindings would sit behind the same origin as static files.

### GitHub Pages

- Good, because it is free and familiar, and deploy is a workflow away.
- Bad, because it is a second provider, the apex requires proxy-off DNS records and a verification record, and there is no versioning or preview story beyond the branch.

### Cloudflare Pages

- Good, because it lives in the same account and offers preview deployments.
- Bad, because Cloudflare now steers new static projects to Workers Static Assets; Pages would add a second deploy mechanism for no capability the site needs.

### A docs generator

- Good, because sidebar, search, and accessibility come for free, and repo markdown can be rendered without copies.
- Bad, because it adds a framework and a build step to a site that is currently four files, and every generator wants content in its own tree, which invites drift.

## Links

- [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Workers best practices: use Workers Static Assets for new projects](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- Related: [ADR-0002](0002-build-on-tanstack-start-and-cloudflare-workers.md), [ADR-0010](0010-expose-a-token-authenticated-rest-api.md), [ADR-0011](0011-cache-only-static-assets-in-the-service-worker.md)
