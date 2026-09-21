## What and why

<!-- One paragraph: what changed and which problem it solves. -->

## How it was verified

<!-- Commands run, pages exercised, edge cases checked. -->

## Checklist

- [ ] `pnpm format:check && pnpm build typecheck test` passes
- [ ] Non-trivial logic has a test, or the PR explains why it does not need one
- [ ] Security-relevant changes (auth, outbound fetches, secrets) are called out above
- [ ] Architectural change: ADR added or superseded in `docs/adr/` (otherwise delete this line)
- [ ] Database change: migration committed, schema and migration agree
