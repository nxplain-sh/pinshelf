# AGENTS.md

Repo-specific notes for coding agents. `README.md` covers the product, stack, and setup; `CONTRIBUTING.md` is the contribution contract (commits, tests, ADRs, database workflow). Read both first. This file records only what they do not make obvious.

## Branching

- `development` is the integration branch, `main` the release branch; both are protected and only change through pull requests. Never commit or push to either directly, and never force-push them.
- Work on a `feat/`, `fix/`, `docs/`, or `chore/` branch based on `development`. A release is a pull request from `development` to `main`, then a `vX.Y.Z` tag on `main`. The full process is in `CONTRIBUTING.md`; move the `[Unreleased]` CHANGELOG entries into the released version as part of the release pull request.

## Commands

- `make setup` once per clone: installs, creates `apps/web/.dev.vars`, applies local D1 migrations.
- `pnpm dev` runs all apps through Turborepo, web on http://localhost:3000. Root dev also launches Chrome with the extension loaded; `pnpm --filter @pinshelf/web dev` is web only.
- `make check` is what CI runs. The exact sequence is `pnpm format:check`, `pnpm lint`, `pnpm --filter @pinshelf/site check:contrast`, then `pnpm build typecheck test` — one turbo invocation: pnpm forwards the extra words to the `build` script (`turbo run build`), so all three tasks run together.
- Single test file: `pnpm --filter @pinshelf/web exec vitest run test/api.test.ts`.
- Web tests live in `apps/web/test/`; shared tests sit next to the code: `pnpm --filter @pinshelf/shared exec vitest run src/security.test.ts`.
- `make test-watch` runs every package's tests in watch mode.
- `make site-dev` serves the static site locally; `make site-deploy` publishes it. The site has no build step.

## Toolchain

- Prettier owns formatting (`semi: false`, single quotes, width 90); Biome owns linting and its formatter is disabled. Use `pnpm format` for whitespace, never Biome.
- Husky + lint-staged run both tools on staged files at commit time.
- Generated, do not edit: `apps/web/src/routeTree.gen.ts` (TanStack Router writes it on dev/build), `apps/web/worker-configuration.d.ts` (`wrangler types`, run by postinstall), anything in `apps/web/migrations/`, and `site/public/assets/` (copies written by `make icons`). Biome and Prettier ignore lists mirror this; `apps/web/scripts/generate-icons.mjs` is excluded too.
- TypeScript is aliased to the TS 6 prerelease (`npm:@typescript/typescript6@^6.0.2`) in every package, and Vitest is pinned to v4 because `@cloudflare/vitest-plugin` peers on it. Do not bump either without checking the peer. The alias ships its binary as `tsc6`, so scripts call `tsc6 --noEmit`; a bare `tsc` only resolves on machines that have one installed globally.

## Architecture

- Worker entry is `apps/web/src/server.ts`: TanStack Start handles `fetch` (wrapped to add security headers), and `scheduled` runs the daily backup plus bounded metadata retries and link checks. Bindings `DB` (D1) and `BACKUPS` (R2) come from `apps/web/wrangler.jsonc`.
- `Dockerfile` (symlinked as `Containerfile`) builds the app and runs the built Worker on workerd through `wrangler dev` with state under `/data`; `docker-entrypoint.sh` writes `.dev.vars`, applies migrations, then starts the server. `compose.yaml` pulls the GHCR image that `.github/workflows/docker.yml` publishes. Scheduled handlers do not fire in a container.
- `.server.ts` marks Worker-only modules; client-safe logic stays in plain `.ts`. Server code reads config through `import { env } from 'cloudflare:workers'` — never `process.env`, and Vite does not feed Worker bindings.
- `~/*` maps to `apps/web/src` (tsconfig paths, Vite, and Vitest all alias it).
- REST API: thin route files under `apps/web/src/routes/api/`, handlers in `lib/api-handlers.server.ts`, request schemas in `lib/api-schemas.ts`. `lib/openapi.ts` reuses those Zod schemas, so the docs stay in sync only if both sides change together. Bearer tokens carry `read`/`write` scopes enforced by `authorizeApiRequest` in `lib/api.server.ts` — pass `'write'` on any mutating handler.
- `POST /mcp` (`lib/mcp.server.ts`, route `routes/mcp.ts`) is a stateless MCP endpoint using those same tokens and scopes; its tools call the same `.server` functions as the REST handlers, so keep the two surfaces in step.
- Views: home is active bookmarks; `/archive` (`archive.index.tsx`) holds the archived and trash lists and `/trash` redirects there; `/tags` owns rename and merge. Sign-out is a server function (`lib/session.ts`) that revokes the session row, called from `components/SignOut.tsx` on every page.
- Preview (`components/BookmarkList.tsx` + `lib/reader.server.ts`) re-serves the snapshot or a live fetch with scripts stripped and a `<base>` injected into a `sandbox=""` iframe; `settings.auto_archive` (migration `0010_chubby_mysterio.sql`) snapshots every new save inline in `createBookmarkRecord`.
- AI features: the `toolbox` drawer (`components/Toolbox.tsx`) covers cleanup scans, tag-merge proposals, and the no-AI duplicate finder; `/bookmarks/$id` has per-bookmark ask buttons. Page text for ask comes from `lib/page-text.server.ts` (snapshot, YouTube transcript, then metadata).
- Auth is Better Auth in `apps/web/src/lib/auth.server.ts`: sign-in rate limits live in D1, two-factor is optional, and the drizzle adapter schema must list every plugin model (`twoFactor`, `rateLimit`) or queries fail at runtime.
- `packages/shared` is consumed as raw TypeScript (`exports` points at `src/index.ts`); there is no build step for it.
- `apps/extension` is a WXT extension (`entrypoints/`, `utils/`); its `typecheck` script runs `wxt prepare` first.
- `site/` is the static marketing site and install docs: hand-written HTML/CSS/JS under `site/public/`, deployed as an assets-only Worker on `pinshelf.app`. The app lives on `app.pinshelf.app`. Its CSS duplicates the app's design tokens by hand and `check-contrast.mjs` is the only guard against drift.

## Tests

- `apps/web/test` runs inside workerd via `@cloudflare/vitest-plugin` against a real in-memory D1; `test/setup.ts` applies `migrations/` before the suite.
- Outbound network is stubbed in `apps/web/vitest.config.ts`: `example.com` returns fixed HTML and `ai.test` is an OpenAI-compatible double. Tests never reach the network; add a stub there for any new host.

## Database

- Schema is `apps/web/src/db/schema.ts`. Change it, then `pnpm db:generate` and `pnpm db:migrate`, and commit the new SQL.
- Never edit a migration that may have been applied anywhere, including locally; add a new one.
- Local D1 state lives in `apps/web/.wrangler`; `make clean` intentionally leaves it in place. Delete that directory to reset the database.

## Secrets and environment

- The Worker reads `apps/web/.dev.vars` in dev and Cloudflare secrets in production. Root `.env` is only for wrangler CLI credentials (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) when not using `wrangler login`. There is no `.env.local`.
- Deploy order: `make d1-create` (paste the id into `wrangler.jsonc`), `make secret-put`, `make db-migrate-remote`, `make deploy`, then `make site-deploy` for the static site. Read the README's deploy section before touching `routes` in either `wrangler.jsonc`.

## Docs, design, brand

- Architectural changes need an ADR: copy `docs/adr/0000-template.md`, fill it in, add the row to `docs/adr/README.md`. Never rewrite an accepted ADR; supersede it.
- The UI is dark only. Use tokens and component classes from `apps/web/src/styles/app.css` as documented in `docs/design.md`; no raw colours.
- `make icons` rasterizes `docs/brand/` into PWA icons, extension icons, the social card, and the copies in `site/public/assets/`. The card is composed in `apps/web/scripts/generate-icons.mjs` from `logo-dark.svg` plus the `TAGLINE` constant there; change the tagline in that constant and rerun.
