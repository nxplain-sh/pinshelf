# Build on TanStack Start and deploy to Cloudflare Workers

- Status: accepted
- Date: 2026-09-20

## Context and Problem Statement

pinshelf needs a full-stack web application that server-renders a bookmark list, exposes API routes for a browser extension, and can be self-hosted by a single person with no infrastructure. The chosen framework decides the deployment model, the cost floor, and how much of the bookmark pipeline can run next to the data.

## Decision Drivers

- One codebase for server-rendered UI and API; no separate backend service to deploy.
- Self-host story: one command deploys the whole app.
- Low cost at one-user scale, ideally free tier.
- Platform services that fit the product roadmap: SQL database, object storage for future archiving, scheduled jobs, AI inference.
- Preference for the TanStack ecosystem (router, query, form, table) across web work.

## Considered Options

- TanStack Start on Cloudflare Workers
- Next.js on Vercel
- SvelteKit on a Node host
- Astro frontend with a separate API service

## Decision Outcome

Chosen option: "TanStack Start on Cloudflare Workers", because it keeps UI, server functions, and API routes in one Vite project that deploys to a Worker with one `wrangler deploy`, and the platform supplies D1, R2, cron triggers, and Workers AI without extra accounts.

### Positive Consequences

- Web UI and REST API share the same deploy, domain, and bindings; `pinshelf.app` is one Worker.
- Self-hosting is `wrangler deploy` plus a D1 database; no server, container, or orchestrator.
- `waitUntil`, cron triggers, cache API, and D1 are available to the metadata pipeline with no external queue.
- Native `HTMLRewriter` removes the need for an HTML parsing dependency.

### Negative Consequences

- Vendor coupling to Cloudflare. The documented escape path is the Nitro Vite plugin, which targets Node and other hosts, at the price of rewriting binding access.
- Workers runtime is not Node: no native modules, limited Node built-ins via `nodejs_compat`, and a bundle size ceiling that Better Auth already consumes a meaningful share of.
- TanStack Start is younger than Next.js, so some ecosystem examples do not translate directly.

## Pros and Cons of the Options

### TanStack Start on Cloudflare Workers

- Good, because Vite, server functions, and type-safe routing are in one place.
- Good, because free tier covers a single-user instance comfortably.
- Good, because Cloudflare services match the roadmap (D1, R2, Queues, Workers AI).
- Bad, because of runtime restrictions and vendor coupling.

### Next.js on Vercel

- Good, because it is the most common full-stack React stack with the largest talent pool.
- Bad, because database and object storage add separate vendors and costs.
- Bad, because self-hosting Next.js well is materially harder than `wrangler deploy`.

### SvelteKit on a Node host

- Good, because lean runtime and excellent defaults.
- Bad, because a Node host means a container or VPS to operate, patch, and pay for.

### Astro frontend with a separate API service

- Good, because content-heavy pages optimize well.
- Bad, because pinshelf is an application, not a content site; a second deployable doubles the operational surface.

## Links

- [TanStack Start hosting guide](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
- [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/)
- Related: [ADR-0003](0003-store-data-in-cloudflare-d1-with-drizzle.md), [ADR-0006](0006-extract-metadata-inline-before-adding-queues.md)
