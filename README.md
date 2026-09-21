<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/logo-dark.svg">
    <img alt="pinshelf" src="docs/brand/logo-light.svg" width="420">
  </picture>
</p>

[![CI](https://github.com/nxplain-sh/pinshelf/actions/workflows/ci.yml/badge.svg)](https://github.com/nxplain-sh/pinshelf/actions/workflows/ci.yml)

Self-hosted bookmark manager in the spirit of Raindrop, Karakeep, and Linkwarden. pin it, shelf it, find it. Single-user, no account to create anywhere but your own instance.

## Stack

- [TanStack Start](https://tanstack.com/start) (Router, server functions) and [TanStack Query](https://tanstack.com/query) on [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/) with [Drizzle ORM](https://orm.drizzle.team/) and SQLite FTS5 for search
- [Better Auth](https://www.better-auth.com/) email/password plus API keys for the extension
- [Zod](https://zod.dev/) at the REST API boundary, [Biome](https://biomejs.dev/) for linting, Prettier for formatting
- Tailwind CSS v4, Turborepo, pnpm workspaces, Vitest (unit tests in `packages/shared`, integration tests in `apps/web` against a real D1)

Design decisions and their rationale live in [`docs/adr/`](docs/adr/); the UI design system is documented in [`docs/design.md`](docs/design.md). Read those before proposing a stack or style change.

## Repository layout

```
apps/web/           TanStack Start app on Cloudflare Workers (the PWA)
apps/extension/     WXT browser extension for Chrome and Firefox
packages/shared/    URL normalization, SSRF guard, search and tag helpers
site/               static marketing site and install docs, served at pinshelf.app
docs/adr/           architecture decision records
```

## Quickstart

Requirements: Node 22 or newer, pnpm (the version is pinned in `package.json`, so `corepack enable` is enough).

```bash
make setup   # install, create apps/web/.dev.vars, apply local migrations
pnpm dev     # start web (and future apps) through Turborepo
```

Open http://localhost:3000. With no users in the database the login page shows the setup form; the first account becomes the owner and later signups are rejected.

### Environment files

| File                         | Committed | Purpose                                                                                                |
| ---------------------------- | --------- | ------------------------------------------------------------------------------------------------------ |
| `apps/web/.dev.vars.example` | yes       | Template for local Worker secrets                                                                      |
| `apps/web/.dev.vars`         | no        | Local secrets the Worker reads in dev (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`)                        |
| `.env.example`               | yes       | Template for Wrangler CLI credentials                                                                  |
| `.env`                       | no        | `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for remote commands when not using `wrangler login` |

There is no `.env.local`. Vite does not feed Worker bindings; the Worker reads `.dev.vars` in development and Cloudflare secrets in production (`make secret-put`).

### Browser extension

`apps/extension` is a WXT extension for Chrome and Firefox. It saves the current page, every open tab, or a right-clicked link using an API token created on the `/settings` page; it badges tabs that are already saved, searches the library from the omnibox (`pin`), saves highlighted selections, summarises the current page through your AI provider, and opens the app in Chrome's side panel. See [apps/extension/README.md](apps/extension/README.md) for load-unpacked instructions and permissions. Note that root `pnpm dev` also launches Chrome with the extension loaded; use `pnpm --filter @pinshelf/web dev` if you only want the web app.

### REST API

Every client-facing route requires `Authorization: Bearer <token>`. The interactive reference is at `/api-docs` (Scalar), and the OpenAPI document is served at `/api/openapi.json` — request schemas are derived from the same Zod schemas the handlers validate with, so the docs cannot drift.

| Route                                   | Purpose                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| `GET /api/bookmarks`                    | List, with `status`, `q`, `tag`, `collection`, `url`, `host` filters          |
| `POST /api/bookmarks`                   | Save a URL with optional `tags`, `notes`, `collectionId`                      |
| `GET /api/bookmarks/$id`                | Fetch one bookmark                                                            |
| `PATCH /api/bookmarks/$id`              | Update fields, tags, collection, or `status`                                  |
| `DELETE /api/bookmarks/$id`             | Delete permanently                                                            |
| `POST /api/bookmarks/$id/ask`           | Ask the model about one bookmark (`summary`, `takeaways`, `plain`, `verdict`) |
| `POST /api/highlights`                  | Add a highlight (quote plus optional note) to a bookmark                      |
| `GET /api/collections`, `GET /api/tags` | Picker data                                                                   |

`GET /api/health` is the one unauthenticated route: it answers `{"ok":true}` after touching the database, and it is what the container healthcheck polls.

### MCP

`POST /mcp` speaks JSON-RPC MCP (streamable HTTP, stateless) with the same `Authorization: Bearer <token>` tokens and `read`/`write` scopes as the REST API, so ChatGPT, Claude, or any MCP client can use the library directly. Tools: `search_bookmarks`, `get_bookmark`, `list_collections`, `list_tags`, `ask_bookmark` (read) and `save_bookmark`, `update_bookmark`, `add_highlight`, `set_status` (write). `GET /mcp` answers `405`; there is no SSE stream. See [ADR-0019](docs/adr/0019-expose-the-library-over-mcp.md).

### AI (bring your own provider)

The `toolbox` button (bottom right) sends a batch of active bookmarks to an OpenAI-compatible endpoint and proposes duplicate groups to trash plus tags, descriptions, and collections to fill in. Configure the base URL, model, and API key under Settings → AI; any provider that speaks `/chat/completions` works, including a local Ollama or vLLM. The key is stored in your database and never returned to the browser after saving. Nothing is applied automatically: proposals are listed with checkboxes, and duplicates go to trash, not deletion. See [ADR-0013](docs/adr/0013-bring-your-own-ai-provider.md).

**Asking about one bookmark.** On a bookmark page, `summarise`, `key takeaways`, `explain simply`, and `worth reading?` answer from the archived snapshot when one exists, from the YouTube transcript for video bookmarks, and from the stored metadata otherwise. The panel says which source it read.

**Preview.** Every row has a `preview` button next to `open`: a small window that renders the page itself — from your snapshot when one exists, otherwise from a live fetch through the same SSRF-guarded path. The HTML is re-served by us with scripts and inline handlers stripped, a `<base>` pointing back at the original site, and a `sandbox=""` iframe, so sites that block framing (`X-Frame-Options`, `frame-ancestors`) render anyway without running their code.
**Auto-archive.** Settings → Backups has `snapshot every new save`: when on, each new bookmark gets its R2 HTML snapshot inline with the save (one fetch and put, same guarded path as the manual action).

**Tag merges.** The toolbox can propose merges for tags that mean the same thing (`recipe` / `recipes`); each pair is reviewed with a checkbox and applied through the same merge path as `/tags`.

Large libraries are scanned in batches of 50 in a single scan (up to 500 bookmarks), proposals are merged across batches, and the result line reports how many batches ran and how many tokens the provider counted. Token-level streaming is not used: proposals are structured JSON, not prose, so the value is in the merged result, not in watching it arrive.

**Tidying unsorted bookmarks.** `tidy unsorted (N)` scans only the active bookmarks that have no collection, up to 500 at a time, and instructs the model that every bookmark in the batch must come back with a collection: prefer an existing one when it genuinely fits, otherwise propose a short new name and reuse it across related rows. Collections are folders, tags are categories — one collection per bookmark (ADR-0009). After applying, the button's count drops; the result line reports anything the model left unassigned, so you can run it again.

**Smart filters.** The `smart` button next to the search box takes a plain-language request ("rust posts, newest first") and asks the model for a filter object: full-text terms, a tag, a collection, a sort. Every field is validated against your actual tags and collections, so a hallucinated tag is dropped instead of run, and a request that yields nothing usable fails with a message rather than an empty list. The interpreted filter is applied through the normal search path, so the usual filter chips, counts, and saved searches all work on it.

**Smart collections.** Collections stay manual folders; smart collections are saved searches that keep matching new saves. The collections page lists them, and `suggest smart collections` asks the model for a few named filters (each with a one-line reason) built from your existing tags and collections. Suggestions are reviewed with checkboxes and only saved when you press save — nothing is created silently.

Both smart features are deliberately cheap and paranoid: the prompt carries only a capped slice of the taxonomy (100 tags, 50 collections) and never your bookmarks, requests are capped at 500 characters, model output is stripped of control characters, collapsed, length-capped before parsing, and refused when it names something the library does not have. Suggestions that would duplicate an existing smart collection are skipped, and a failed interpretation never changes your filters.

### Ordering

The sort control offers `newest first`, `oldest first`, `title a–z`, `title z–a`, and `manual order (drag)`. Manual mode adds drag handles: drop a row anywhere in the list and the order is saved as a per-bookmark index. Bookmarks saved after a reorder sort to the top until you rearrange again, and searching keeps relevance ranking regardless of the sort control. The order is served over the API as `?sort=manual`.

### Keyboard

`cmd/ctrl + k` opens a command palette that searches the library; `j`/`k` move the highlight down and up the list, `enter` opens, `x` selects, `t` trashes, `a` archives, and `?` shows the shortcut list. Shortcuts stay quiet while a field has focus.

### Archive

Rows move between `active`, `archived`, and `trashed`. Archiving keeps a page out of the default list without sending it to the trash; the `archive` link in the header shows both views, and the API accepts `status=archived` anywhere it accepts `active` or `trashed`.

### Library upkeep

The daily cron does two bounded passes besides the backup: it retries metadata for saves that failed (up to three attempts), and it re-checks links that have not been checked in 30 days with a guarded `HEAD` request. A page that no longer answers shows `link looks broken` in the list. The toolbox also groups duplicates without AI: rows whose urls differ only by query string, fragment, or trailing slash are listed together so you can trash the extras. Tags and collections are stored lowercase — `normalizeTagName` lowercases every name on the way in, so `iOS` and `ios` are the same row. Tags can be renamed, or merged into another tag, from `/tags`, or suggested in bulk by the toolbox. `/insights` charts the library: counts by status, broken links, metadata failures, snapshots, saves per month, top hosts, and top tags.

### Page snapshots

`archive page` on a bookmark detail page fetches the page through the same SSRF-guarded path metadata uses and stores the HTML in your R2 bucket, one snapshot per bookmark, capped at 2MB. `view snapshot` serves it back from `/archive/$id` inside a sandbox CSP, so archived scripts cannot run or touch your session. Deleting a bookmark deletes its snapshot; see [ADR-0017](docs/adr/0017-archive-pages-into-r2-as-untrusted-html.md). Relative assets usually 404 — the snapshot is text and structure, not a pixel-perfect copy.

### Highlights

A bookmark detail page keeps the lines worth rereading: paste a passage, add an optional note, and it is stored against that bookmark (deleting the bookmark deletes its highlights). Highlights are not part of search yet, and the JSON export does not carry them.

### Saved searches

Any filtered view can be saved by name: the chips row above the list stores the filters and brings the view back in one click. Saved searches live in the database, not in the URL.

### Sharing one bookmark

A bookmark detail page can mint a public, read-only link at `/s/<token>`, optionally expiring in 7 or 30 days, up to five live links per bookmark, each revocable. The page is `noindex` and shows only that bookmark; see [ADR-0018](docs/adr/0018-share-single-bookmarks-with-revocable-links.md).

### Backups

A daily cron writes a JSON snapshot of the library into an R2 bucket, and Settings → Backups can write one on demand, list what exists, restore from a snapshot, or delete one. The retention is configurable (7 to 365 snapshots, 30 by default); the schedule itself is fixed at deploy time in `wrangler.jsonc`. Restoring is additive: missing bookmarks are added, existing ones are untouched, and trashed bookmarks come back trashed. The same JSON file can be restored through the normal import flow. Self-hosters create the bucket once with `make r2-create`; see [ADR-0014](docs/adr/0014-back-up-the-library-to-r2.md).

### Install as an app

pinshelf ships a web app manifest and a static-asset service worker, so it installs from the browser on Android, desktop, and iOS (Share → Add to Home Screen). The manifest also declares a share target: sharing a link from any app opens `/share` with the URL prefilled. Icons come from `make icons`, which rasterizes `docs/brand/` into PWA icons, extension icons, and the served social card. The service worker never caches HTML or API responses; see [ADR-0011](docs/adr/0011-cache-only-static-assets-in-the-service-worker.md). The bookmark list is cached in `localStorage` per filter set instead, so an open app keeps reading on a flaky connection — with a banner saying how old the cached copy is, never silently.

### Import and export

The `/settings` page imports four formats, detected by content rather than file extension:

| Format | Source                                             | Notes                                                                                                                                                                                                                                 |
| ------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTML   | Chrome, Firefox, Safari, Raindrop (Backups → HTML) | Folders become collections, nested as `parent/child`; `TAGS` become tags; `<DD>` lines become descriptions; `ADD_DATE` becomes the created date; Raindrop's `Unsorted` folder maps to no collection                                   |
| CSV    | Raindrop export, spreadsheets                      | Header-driven: `url` is required, `title`, `note`, `excerpt`/`description`, `tags`, `folder`/`collection`, `created` (unix or ISO) are used when present                                                                              |
| ENEX   | Evernote export                                    | One bookmark per note, using `<source-url>` when present and otherwise the first link in the note body; note text becomes notes, `<tag>` elements become tags, `<created>` becomes the created date; notes without a link are skipped |
| TXT    | One URL per line                                   | A trailing title after the URL is kept; `#` lines are ignored                                                                                                                                                                         |

Non-http entries such as bookmarklets are skipped, duplicates are skipped by URL, and imports never fetch metadata: titles and descriptions come from the file. Exports are a full JSON backup (including notes), a Netscape HTML file for other bookmark managers, and a Markdown reading list.

### Make targets

Turbo covers build, typecheck, tests, and dev. Everything around it lives in the Makefile:

```bash
make help              # list every target
make check             # what CI runs: format, build, types, tests
make db-migrate        # local D1 migrations
make db-migrate-remote # remote D1 migrations
make secret            # generate a BETTER_AUTH_SECRET value
make deploy            # build and deploy the web app to Cloudflare
make site-deploy       # deploy the static site to Cloudflare
make clean             # drop build output and caches
```

## Scripts

| Command                             | Purpose                                                   |
| ----------------------------------- | --------------------------------------------------------- |
| `pnpm dev`                          | Run all dev servers through Turborepo                     |
| `pnpm build`                        | Build all packages and apps                               |
| `pnpm typecheck`                    | TypeScript across the workspace                           |
| `pnpm test`                         | Unit tests plus integration tests against an in-memory D1 |
| `pnpm format` / `pnpm format:check` | Prettier write / verify                                   |
| `pnpm lint` / `pnpm lint:fix`       | Biome check / autofix                                     |
| `pnpm db:generate`                  | Generate a Drizzle migration from the schema              |
| `pnpm db:migrate`                   | Apply migrations to the local D1 database                 |
| `pnpm deploy`                       | Build and deploy the web app to Cloudflare                |

### Tests

`packages/shared` holds unit tests for pure logic (URL normalization, SSRF guard, FTS query building, Netscape parsing). `apps/web/test` holds integration tests that run inside the Workers runtime against a real in-memory D1 with a stubbed outbound network, covering the REST API (auth, validation, dedupe, search, filters, trash) and the data layer (tags, bulk updates, import and export). Run a single file with `pnpm --filter @pinshelf/web exec vitest run test/api.test.ts`.

## Deploy to Cloudflare

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/nxplain-sh/pinshelf)

The button clones the repository into your Cloudflare account and deploys the Worker. Then finish the setup:

1. `make d1-create` and paste the database id into `apps/web/wrangler.jsonc` (skip if the deploy flow provisioned D1 for you, but check the binding id).
2. `make secret-put` to upload `BETTER_AUTH_SECRET` (generate one with `make secret`).
3. `make db-migrate-remote`.
4. `make deploy` — the app answers on `app.pinshelf.app` once the `pinshelf.app` zone is active in the account.
5. `make site-deploy` — publishes the static site (landing page and install docs) on `pinshelf.app`.

Manual path, same steps: `make cf-login`, then 1–5 above. Remote commands use your `wrangler login` session, or `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from a root `.env` (copy `.env.example`) in CI.

Until the custom domain is enabled the Worker is reachable on its `workers.dev` address; set `BETTER_AUTH_URL` in `wrangler.jsonc` to that origin if it differs from `https://app.pinshelf.app`.

## Self-host with Docker

[![Deploy on Hostinger](https://assets.hostinger.com/vps/deploy.svg)](https://www.hostinger.com/docker-hosting?compose_url=https://raw.githubusercontent.com/nxplain-sh/pinshelf/main/compose.yaml&REFERRALCODE=BV0GMAILNSKR)

`compose.yaml` runs the built Worker on workerd with its D1 database and R2 bucket under the `pinshelf-data` volume, so no Cloudflare account is involved. Set `BETTER_AUTH_SECRET` (generate one with `make secret`) and `BETTER_AUTH_URL` to the public origin, then:

```bash
docker compose up -d
```

The image is published to `ghcr.io/nxplain-sh/pinshelf` by [`.github/workflows/docker.yml`](.github/workflows/docker.yml); build it locally instead with `docker build -t ghcr.io/nxplain-sh/pinshelf .`. Migrations are applied on start. Everything lives in the one volume, so stop the container and copy the volume for a backup. The daily cron trigger only runs on Cloudflare — outside it, use Settings → Backups → Back up now.

## Security

Report vulnerabilities privately, never in a public issue. See [SECURITY.md](SECURITY.md). The short version: single-user instance, sessions and API keys through Better Auth, SSRF-guarded metadata fetches, secrets only in `.dev.vars` locally and `wrangler secret` in production.

Sign-in and second-factor verification are rate limited (5 attempts a minute, tracked in D1 so the limit survives cold starts). Two-factor authentication is optional: Settings → Two-factor generates a TOTP secret, shows it as a QR code (rendered locally, no third-party request) plus one-time backup codes, and asks for one six-digit code to switch it on. The generated code is valid for ten minutes — the panel counts down, and when it runs out the pending secret is deleted server-side and a new one must be generated; abandoned enrollments are pruned by the daily cron after a day. An unverified secret can never sign anyone in, so an expired code is inert rather than dangerous. Settings → Sessions lists every signed-in device and can revoke one or all others. API tokens can be read-only and can carry an expiry date; a read-only token gets `403` from any write route.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branch and release process: `development` integrates, `main` releases, both take changes only through pull requests, and a release is a pull request plus a `vX.Y.Z` tag. Architectural changes need an ADR in `docs/adr/` alongside the code.

## License

[MIT](LICENSE)

## Terms

[TERMS_OF_SERVICE.md](TERMS_OF_SERVICE.md) covers running the software and, if someone hosts an instance for you, using that instance. It does not restrict anything the MIT license grants you.
