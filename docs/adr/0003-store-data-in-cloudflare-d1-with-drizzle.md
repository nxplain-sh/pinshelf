# Store data in Cloudflare D1 with Drizzle ORM

- Status: accepted
- Date: 2026-09-20

## Context and Problem Statement

pinshelf stores bookmarks, tags, collections, and full-text search indexes, and it will be self-hosted by individuals. The database choice determines the self-host story (does the operator provision anything?), the query capabilities available later (full-text search, embeddings), and how much migration pain a future multi-user release inherits.

## Decision Drivers

- Zero provisioning: self-hosting must not require creating a database server.
- Full-text search for bookmark title, description, notes, and URL without a search service.
- Same-platform latency: queries should not cross a network boundary the operator has to configure.
- Typed schema and migrations checked into the repository.
- Acknowledged escape path if multi-user hosting arrives.

## Considered Options

- Cloudflare D1 (SQLite) with Drizzle ORM
- Postgres on Neon or Supabase with Drizzle over Hyperdrive
- Turso (hosted SQLite) with Drizzle
- Cloudflare KV or Durable Object storage

## Decision Outcome

Chosen option: "Cloudflare D1 with Drizzle ORM", because it binds directly into the Worker, costs nothing at single-user scale, supports SQLite FTS5 for search, and Drizzle generates plain SQL migrations that Wrangler applies locally and remotely.

### Positive Consequences

- A self-hoster runs `wrangler d1 migrations apply ... --remote`; there is no connection string, pool, or network hop to configure.
- FTS5 virtual tables plus `bm25()` ranking cover Phase 2 search without adding a service.
- Drizzle gives one typed schema file that doubles as the data model reference, and `drizzle-kit generate` produces reviewable SQL diffs.
- Local development uses the same engine through the Vite plugin's D1 emulation.

### Negative Consequences

- SQLite has a single writer; write-heavy multi-user scenarios will serialize. This is acceptable for a single-user product and is a known cost if multi-user hosting arrives.
- No native vector type, so an embedding-based feature would store vectors as blobs and compute similarity in application code.
- Moving to Postgres later means rewriting migrations and the query layer, though Drizzle keeps that mostly mechanical.

## Pros and Cons of the Options

### Cloudflare D1 with Drizzle

- Good, because it is already inside the Worker; bindings need no secrets.
- Good, because SQLite FTS5 solves search without another dependency.
- Good, because free tier is generous relative to one person's bookmark collection.
- Bad, because single-writer limits and no vector support.

### Postgres on Neon or Supabase with Drizzle over Hyperdrive

- Good, because of `pgvector`, robust full-text search, and real concurrency.
- Bad, because self-hosting now means an account, a connection string, and a second vendor.
- Bad, because Hyperdrive adds a configuration surface with no benefit at one-user scale.

### Turso with Drizzle

- Good, because SQLite semantics with replication and edge reads.
- Bad, because it is another vendor account to create for self-hosters, with no capability D1 lacks here.

### Cloudflare KV or Durable Object storage

- Good, because both are native to the platform.
- Bad, because neither offers relational queries or full-text search; bookmarks need both.

## Links

- [Cloudflare D1 documentation](https://developers.cloudflare.com/d1/)
- [Drizzle ORM SQLite](https://orm.drizzle.team/docs/get-started-sqlite)
- Related: [ADR-0002](0002-build-on-tanstack-start-and-cloudflare-workers.md)
