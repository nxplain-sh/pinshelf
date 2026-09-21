# Maintain the FTS5 search index in application code

- Status: accepted
- Date: 2026-09-20

## Context and Problem Statement

Search must cover bookmark title, description, notes, URL, and tag names, ranked so that the best match is first. D1 is SQLite, so FTS5 is available in the database itself. The complication: FTS5 virtual tables cannot be expressed in the Drizzle schema, so `drizzle-kit generate` will never produce them, and the indexed text includes tag names that live in another table.

## Decision Drivers

- Search must include tags, which are not columns on `bookmarks`.
- No search service, no extra vendor, no sync lag.
- Ranked results, not just substring matches.
- The index must be reconstructible from the source tables at any time.
- Query input comes from a user and must never reach the FTS5 query parser raw.

## Considered Options

- FTS5 table maintained by application code
- FTS5 external-content table with SQL triggers
- `LIKE '%term%'` queries over the existing columns
- A separate search service (Meilisearch, Typesense)

## Decision Outcome

Chosen option: "FTS5 table maintained by application code", because tags need to be part of the indexed text, and trigger-managed external-content tables cannot denormalize a joined value without writing the join result back to a column on `bookmarks`.

The table is created by a hand-written migration (`0004_search.sql`), since `drizzle-kit` does not model virtual tables. A single helper, `reindexBookmarks(ids)`, deletes and re-inserts the FTS rows for the given bookmarks; it is called after every write that changes indexed text: create, update, tag replacement, bulk update, metadata refresh, and delete. Query text is converted to a safe prefix query by `buildFtsQuery` in `packages/shared`, which strips everything except letters, numbers, and underscores before quoting each token. Ranking uses `bm25(bookmarks_fts)`.

### Positive Consequences

- Tag names are searchable in the same ranked query as the text.
- No search service, no replication lag, no extra cost.
- `buildFtsQuery` is a pure function with tests, so hostile input cannot reach FTS5 operators.
- The index is fully derived: deleting all rows and reindexing every bookmark rebuilds it.

### Negative Consequences

- Index freshness is application responsibility. A future write path that forgets `reindexBookmarks` produces silent search drift. The compensation is that there is exactly one helper to call and one place to look.
- `reindexBookmarks` does delete-plus-insert per bookmark; a bulk operation over 200 bookmarks issues several hundred statements.
- No stemming and no typo tolerance. Prefix matching covers the common case ("react" finds "reactive"), but "reaction" does not find "reactions" and "reakt" finds nothing.
- FTS5 tokenization rules (unicode61 with `remove_diacritics 2`) are a behaviour surface to remember when debugging unexpected matches.

### Revisit trigger

Add a `reindexAll` maintenance command or move to trigger-based sync if drift is ever observed. Move to a dedicated search service only if multi-user hosting arrives or fuzzy, stemmed, or typo-tolerant search is demanded.

## Pros and Cons of the Options

### FTS5 maintained by application code

- Good, because tags are indexed alongside the text.
- Good, because it is testable and rebuildable.
- Bad, because sync correctness depends on discipline in the write paths.

### FTS5 external content with triggers

- Good, because the database guarantees sync for column-level changes.
- Bad, because it cannot index joined tag names without denormalizing into a `bookmarks` column, which reintroduces application-written state anyway.
- Bad, because trigger logic is invisible to TypeScript and harder to test.

### `LIKE` queries

- Good, because zero schema work.
- Bad, because no ranking, no prefix semantics, and full scans.

### Separate search service

- Good, because stemming, typo tolerance, and facets come free.
- Bad, because a self-hosted app should not require another service for personal-scale search.

## Links

- [SQLite FTS5 documentation](https://sqlite.org/fts5.html)
- [Cloudflare D1 SQL features](https://developers.cloudflare.com/d1/sql-api/sql-statements/)
- Related: [ADR-0003](0003-store-data-in-cloudflare-d1-with-drizzle.md)
