# Contributing to pinshelf

Thanks for considering a contribution. This document covers how to get set up and what a good change looks like here.

## Development setup

Requirements: Node 22 or newer and pnpm. Run `corepack enable` once; the pinned pnpm version comes from `package.json`.

```bash
make setup   # install, create apps/web/.dev.vars, apply local migrations
pnpm dev
```

Open http://localhost:3000. With zero users in the local database, the login page shows the setup form; the first account becomes the owner.

`make help` lists the targets that sit outside Turbo (database, secrets, deploy, clean). Local secrets live in `apps/web/.dev.vars`; see the environment files table in the README.

Vitest is pinned to v4 across the workspace because `@cloudflare/vitest-plugin` peers on `^4.1.0`. Bump it only when the plugin supports a newer major.

## Branching and releases

`development` is the integration branch and `main` is the release branch. Both are protected: no direct pushes, every change lands through a pull request, including from maintainers.

- Branch from `development` with a short, typed name: `feat/toolbox-drawer`, `fix/signout-origin`, `docs/branching`.
- Open the pull request against `development`. CI (`format, build, types, tests`) and the Docker build must pass; keep the branch rebased on `development` rather than merging it back in, so history stays linear.
- `development` may be merged at any time; it is not expected to be releasable every minute.

Releasing:

1. Branch `release/X.Y.Z` off `development` (or off `main` for a hotfix) and move the `[Unreleased]` entries in [CHANGELOG.md](CHANGELOG.md) under `## [X.Y.Z] - YYYY-MM-DD`, leaving a fresh empty `[Unreleased]` section. Versions follow [SemVer](https://semver.org): breaking changes bump the major, features the minor, fixes the patch.
2. Open a pull request from `release/X.Y.Z` to `main` titled `release: X.Y.Z`. The full CI matrix and the Docker build run on it.
3. Merge the pull request once green, then tag the merge commit on `main` and push the tag:

   ```bash
   git checkout main && git pull
   git tag -a v0.2.0 -m "pinshelf 0.2.0"
   git push origin v0.2.0
   ```

4. The tag does three things: `.github/workflows/release.yml` publishes a GitHub release with generated notes, `.github/workflows/docker.yml` builds and signs `ghcr.io/nxplain-sh/pinshelf:v0.2.0`, and `latest` keeps tracking `main`.
5. Open a pull request from `main` back into `development` (both are protected, so the release commit cannot be pushed directly) so the next cycle starts from the release commit.

Hotfixes take the same path with a `fix/` branch off `main`, merged back into both `main` (patch tag) and `development`.

## Before opening a pull request

Run the same checks CI runs:

```bash
pnpm format:check
pnpm lint
pnpm --filter @pinshelf/site check
pnpm build typecheck test
```

`pnpm format` fixes formatting, `pnpm lint:fix` fixes what Biome can fix. Prettier owns formatting and Biome owns linting; do not argue with either in review.

## What a good change looks like

- **Smallest diff that solves the problem.** Fix the root cause, not the symptom, and do not refactor neighbourhoods you were not asked to touch.
- **Tests for non-trivial logic.** Pure logic that can silently break (URL handling, security guards, parsers) needs a Vitest case next to it in `packages/shared`. Behaviour that touches the database or the REST API belongs in `apps/web/test`, which runs against a real in-memory D1. Trivial one-liners do not need a test.
- **Security at trust boundaries is not optional.** Validate input, guard outbound fetches, never log secrets. If a change touches auth or the metadata fetcher, say so explicitly in the pull request.
- **UI changes follow the design system.** Tokens and component classes from `apps/web/src/styles/app.css`, dark only, no raw colours. See [docs/design.md](docs/design.md).
- **Conventional Commits.** `feat:`, `fix:`, `docs:`, `refactor:`, `chore:` with a scope when it helps, for example `fix(web): reject empty bookmark URLs`.
- **No new dependencies for what a few lines can do.** If you do add one, explain in the pull request what it replaces. Install scripts must be allowlisted in `pnpm-workspace.yaml` (`allowBuilds`) before they run.

## Architectural changes need an ADR

A change is architectural when it is expensive to reverse, constrains more than one module, or adds a dependency or platform service. Those changes need a record in [`docs/adr/`](docs/adr/) committed alongside the code:

1. Copy `docs/adr/0000-template.md` to the next free number.
2. Fill in context, options, and honest consequences.
3. Add the row to the index in `docs/adr/README.md`.
4. Do not rewrite accepted ADRs; supersede them with a new one.

## Database changes

Edit `apps/web/src/db/schema.ts`, then:

```bash
pnpm db:generate   # writes a new SQL migration
pnpm db:migrate    # applies it to the local D1 database
```

Commit the migration. Do not edit an already-applied migration, including in development, if there is any chance someone else has run it; add a new one instead.

## Reporting bugs and requesting features

Use the issue templates. For anything security related, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Code of conduct

Participation is covered by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

Contributions are accepted under the MIT license, see [LICENSE](LICENSE).
