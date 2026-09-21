# docs

Living documentation for pinshelf. Code shows what the system does; these pages explain why.

## Contents

- [`adr/`](./adr/) — architecture decision records. Every architecturally significant choice is written down with its context, options, and consequences. Start with [`adr/README.md`](./adr/README.md).
- [`design.md`](./design.md) — UI design system: tokens, component classes, and the rules for extending them.

## Not here yet

- Deployment runbook (arrives with the Phase 4 deploy button and custom domain)
- API reference for the extension (arrives with Phase 3)
- Data model reference (generated from `apps/web/src/db/schema.ts`, add when the schema stops fitting on one screen)

## Conventions

- One topic per file, present tense, no dates in prose except where the date is the point.
- Decisions are amended by adding a new ADR, never by rewriting an accepted one.
