# Back up the library to R2 as JSON snapshots

- Status: accepted
- Date: 2026-09-20

## Context and Problem Statement

A self-hosted instance keeps everything in one D1 database inside the operator's Cloudflare account. Exports exist, but they are browser downloads: nothing happens unless someone remembers to click, and nothing protects against an accidental `DELETE`, a bad import, or a corrupted row. D1 has point-in-time recovery on paid plans only, so the free path has no safety net at all. Where should backups live, and what should they contain?

## Decision Drivers

- The operator must be able to recover from a mistake without Cloudflare support.
- No new vendor: the platform already offers object storage next to the database.
- Backups must be restorable by the app itself, not just downloadable.
- Cost must stay negligible for a personal library.
- The backup format must not be a private blob: it should be the same JSON the export already produces.

## Considered Options

- JSON snapshots in Cloudflare R2, written on a daily cron and on demand
- Rely on D1 point-in-time recovery
- SQL dump into R2
- Backups pushed to an external provider (S3, Dropbox, Google Drive)
- No automated backups; keep manual export only

## Decision Outcome

Chosen option: "JSON snapshots in R2", because R2 is already one binding away, costs nothing at this scale, and the snapshot is the export format the app can already parse.

A custom Worker entry (`apps/web/src/server.ts`) adds a `scheduled` handler to the TanStack Start fetch handler. A cron trigger runs daily at 03:00 UTC, writes `backups/<ISO timestamp>.json` into the `pinshelf-backups` bucket, and prunes everything past the newest 30. The same write path is exposed as a "Back up now" action on the settings page. Restore reads the object and feeds it through the existing import pipeline, so restoring is subject to the same rules as any other import: URL-normalized, deduplicated, and additive. Trashed bookmarks in a backup come back trashed rather than being resurrected.

### Positive Consequences

- Recovery is a button, not a support ticket, and works on the free plan.
- The snapshot format is the public JSON export, so a backup can also be restored through the normal import flow from a downloaded file.
- Restores cannot duplicate or overwrite: existing bookmarks are untouched, and only missing URLs are added.
- Retention is bounded, so storage cannot grow without limit.
- R2 stays inside the operator's account; no third party sees the library.

### Negative Consequences

- R2 is a second binding and a second bucket to create (`make r2-create`); self-hosters who skip it get a clear error rather than silent failure.
- Backups are a snapshot of the database rows, not of R2 objects or the build itself: nothing else exists to back up yet, but that changes if archiving lands.
- A cron at a fixed time is not a schedule the operator can configure yet.
- Restore is additive, so it cannot roll a library back to an earlier state; it only fills gaps. Undoing a bad bulk edit needs a manual delete first.
- Anyone with access to the bucket reads the whole library, including notes, so the bucket is as sensitive as the database.

### Revisit trigger

Add configurable schedules, retention, and true point-in-time restore when operators ask for rollback rather than gap-filling. Move to SQL dumps only if a future schema outgrows what the JSON export represents.

## Pros and Cons of the Options

### JSON snapshots in R2

- Good, because the format is already the public export and the importer already parses it.
- Good, because it costs nothing and stays inside the account.
- Bad, because restore is additive, not a rollback.

### D1 point-in-time recovery

- Good, because it is a true rollback with no code.
- Bad, because it is a paid feature and only covers a window; the free plan gets nothing.

### SQL dump into R2

- Good, because it captures the schema and every row exactly.
- Bad, because it is not portable across schema changes, cannot be restored by the app, and D1 has no `VACUUM INTO` exposed to Workers.

### External provider

- Good, because the backup survives losing the whole Cloudflare account.
- Bad, because it adds OAuth or credentials, a second vendor, and an outbound copy of the entire library.

### Manual export only

- Good, because nothing to build.
- Bad, because it depends on remembering, which is exactly what fails in the moment it matters.

## Links

- [Cloudflare R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/)
- [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- Related: [ADR-0003](0003-store-data-in-cloudflare-d1-with-drizzle.md), [ADR-0002](0002-build-on-tanstack-start-and-cloudflare-workers.md)
