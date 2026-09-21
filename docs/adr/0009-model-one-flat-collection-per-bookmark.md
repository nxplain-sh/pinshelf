# Model one flat collection per bookmark

- Status: accepted
- Date: 2026-09-20

## Context and Problem Statement

Bookmarks need grouping beyond tags. Raindrop puts bookmarks in multiple collections and nests them; Karakeep uses lists; Linkwarden nests collections. pinshelf must choose a shape now, knowing the choice is embedded in the schema and every query.

## Decision Drivers

- The UI must stay legible for one person's library.
- Tags already provide unlimited multi-dimensional labelling; collections should provide one clear home.
- Deleting a collection must never delete bookmarks.
- Queries and filters should stay simple enough to reason about in SQL by hand.

## Considered Options

- One nullable collection per bookmark, flat
- Many-to-many bookmarks to collections
- Nested collection tree
- Tags only, no collections at all

## Decision Outcome

Chosen option: "One nullable collection per bookmark, flat", because it gives a bookmark exactly one home (or none, which the UI exposes as "Unsorted"), keeps filtering a single equality condition, and leaves tags to carry everything multi-dimensional.

`bookmarks.collectionId` is a nullable foreign key to `collections` with `ON DELETE SET NULL`. `deleteCollection` also clears assignments explicitly rather than relying on the foreign key alone, so behaviour is identical regardless of pragma state. Collection names are unique case-insensitively through a `nameKey` column.

### Positive Consequences

- Filtering by collection is one indexed equality; "Unsorted" is `IS NULL`.
- Deleting a collection cannot lose bookmarks.
- The UI needs no drag-and-drop or tree widget; a select and a filter dropdown suffice.

### Negative Consequences

- A bookmark cannot belong to two collections. Workarounds are tags or accepting one home.
- No nesting, so large libraries flatten into a long list.
- Moving to many-to-many later means a junction table, a data migration, and UI changes. The migration itself is mechanical (copy `collectionId` into the junction table, drop the column), which is why this is reversible enough to accept now.

### Revisit trigger

When a real need appears for a bookmark in two collections, or for nested browsing of a large library.

## Pros and Cons of the Options

### One nullable collection, flat

- Good, because simple in schema, queries, and UI.
- Good, because "Unsorted" falls out naturally.
- Bad, because no multi-home and no nesting.

### Many-to-many

- Good, because a bookmark can live in several places, like Raindrop.
- Bad, because every list query gains a join, and the UI needs multi-select or chips per bookmark for a benefit not yet demonstrated.

### Nested tree

- Good, because large libraries stay browsable.
- Bad, because tree queries, move operations, and cycle prevention are real complexity for a personal library.

### Tags only

- Good, because one organizing system instead of two.
- Bad, because tags are flat and noisy; a single "home" per bookmark is a genuinely different affordance.

## Links

- Related: [ADR-0003](0003-store-data-in-cloudflare-d1-with-drizzle.md)
