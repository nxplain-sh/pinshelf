# Architecture decision records

An architecture decision record (ADR) captures one architecturally significant decision: the context, the options, the choice, and the consequences. Code or git history can show what changed; an ADR is the only place that keeps the why.

This log follows the conventions from [architecture-decision-record](https://github.com/architecture-decision-record/architecture-decision-record), using the [MADR template](https://github.com/architecture-decision-record/architecture-decision-record/tree/main/locales/en/templates/decision-record-template-of-the-madr-project) as the starting point.

## Conventions

- File name: `NNNN-present-tense-imperative-phrase.md`, for example `0007-guard-outbound-fetches-against-ssrf.md`.
- Numbering is sequential and never reused.
- One decision per record. If a decision is woven from several, split it.
- Records are immutable. To change a decision, add a new record and mark the old one `superseded by [ADR-NNNN](NNNN-....md)`. Typo and link fixes are fine; rewriting rationale is not.
- Status values: `proposed`, `accepted`, `deprecated`, `superseded by [ADR-NNNN](NNNN-....md)`.
- A record is worth writing when the decision is expensive to reverse, constrains more than one module, or future maintainers will ask "why on earth".

## Adding a record

1. Copy [`0000-template.md`](./0000-template.md) to `NNNN-your-decision.md`.
2. Fill in context, options, and consequences. Keep the honest trade-offs in; an ADR with no downsides is unfinished.
3. Reference related records in the Links section.
4. Commit it in the same change as the code it describes, or before.

## Index

| ADR                                                              | Decision                                                      | Status   |
| ---------------------------------------------------------------- | ------------------------------------------------------------- | -------- |
| [0001](./0001-adopt-pnpm-workspaces-and-turborepo.md)            | Adopt pnpm workspaces and Turborepo for the monorepo          | accepted |
| [0002](./0002-build-on-tanstack-start-and-cloudflare-workers.md) | Build on TanStack Start and deploy to Cloudflare Workers      | accepted |
| [0003](./0003-store-data-in-cloudflare-d1-with-drizzle.md)       | Store data in Cloudflare D1 with Drizzle ORM                  | accepted |
| [0004](./0004-keep-pinshelf-single-user-with-better-auth.md)     | Keep pinshelf single-user and authenticate with Better Auth   | accepted |
| [0005](./0005-ship-pwa-and-extension-before-native-shells.md)    | Ship a PWA and a browser extension before native shells       | accepted |
| [0006](./0006-extract-metadata-inline-before-adding-queues.md)   | Extract metadata inline before adding durable queues          | accepted |
| [0007](./0007-guard-outbound-fetches-against-ssrf.md)            | Guard every outbound fetch of user-supplied URLs against SSRF | accepted |
| [0008](./0008-maintain-the-fts5-index-in-application-code.md)    | Maintain the FTS5 search index in application code            | accepted |
| [0009](./0009-model-one-flat-collection-per-bookmark.md)         | Model one flat collection per bookmark                        | accepted |
| [0010](./0010-expose-a-token-authenticated-rest-api.md)          | Expose a token-authenticated REST API for non-browser clients | accepted |
| [0011](./0011-cache-only-static-assets-in-the-service-worker.md) | Cache only static assets in the service worker                | accepted |
| [0012](./0012-use-tanstack-query-for-client-data.md)             | Use TanStack Query for client data and mutations              | accepted |
| [0013](./0013-bring-your-own-ai-provider.md)                     | Let users bring their own AI provider for cleanup             | accepted |
| [0014](./0014-back-up-the-library-to-r2.md)                      | Back up the library to R2 as JSON snapshots                   | accepted |
| [0015](./0015-serve-the-project-site-from-the-apex-domain.md)    | Serve the project site from the apex domain as static assets  | accepted |
| [0016](./0016-self-host-with-docker-on-workerd.md)               | Self-host with Docker by running the built Worker on workerd  | accepted |
| [0017](./0017-archive-pages-into-r2-as-untrusted-html.md)        | Archive pages into R2 as untrusted HTML snapshots             | accepted |
| [0018](./0018-share-single-bookmarks-with-revocable-links.md)    | Share single bookmarks with revocable public links            | accepted |
| [0019](./0019-expose-the-library-over-mcp.md)                    | Serve the library over MCP as well as REST                    | accepted |
