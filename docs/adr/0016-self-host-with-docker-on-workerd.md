# Self-host with Docker by running the built Worker on workerd

- Status: accepted
- Date: 2026-09-20

## Context and Problem Statement

pinshelf is a Cloudflare Worker: the fetch handler runs on workerd, data lives in D1, and backups live in R2. The install docs nonetheless promise a single container with one volume for people who keep a VPS, a NAS, or a Pi and do not want a Cloudflare account. There is no Node server to package, so what exactly does the container run?

## Decision Drivers

- The self-host path must not fork the application: one build, one behavior.
- The operator must get a working instance from `docker compose up -d` alone.
- State must persist in a single volume that is easy to back up.
- No new vendor account, no outbound dependency on Cloudflare at runtime.
- The image should build in CI and be pullable by a deploy button.

## Considered Options

- Containerize the built Worker and run it on workerd through `wrangler dev` with local persistence
- Ship Cloudflare deployment only
- Write a Node server and move the data layer to `better-sqlite3` or `libsql`
- Run `wrangler dev --remote` in the container against real D1 and R2 bindings

## Decision Outcome

Chosen option: "run the built Worker on workerd", because workerd is the same runtime the Worker already targets, and miniflare's local D1 and R2 implementations persist to disk, so the container needs no Cloudflare account and no application changes.

The multi-stage `Dockerfile` builds `apps/web` exactly as the Cloudflare deploy does (`vite build`) and copies `dist/` plus `migrations/` into a slim runtime image. `docker-entrypoint.sh` writes `.dev.vars` from `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`, applies D1 migrations with `wrangler d1 migrations apply --local`, and starts `wrangler dev` bound to `0.0.0.0:3000` with `--persist-to /data`. `compose.yaml` maps one port and one named volume, and `.github/workflows/docker.yml` publishes the image to `ghcr.io/nxplain-sh/pinshelf` so the Hostinger deploy button can pull it without a local build.

### Positive Consequences

- One build and one codebase serve both targets; the container runs the same Worker bundle that Cloudflare gets.
- `docker compose up -d` is the whole install: no account, no CLI, no separate migration step.
- The database, local R2 objects, and uploaded state sit in `/data`, so a volume tarball is a backup.
- The image is small and reproducible: Node, wrangler, the bundle, and the migrations.
- Nothing calls Cloudflare or any other service at runtime.

### Negative Consequences

- `wrangler dev` is a development server, not a supported production runtime: no guarantees, no graceful update path, and the operator rebuilds or re-pulls for every upgrade.
- Scheduled handlers do not fire under `wrangler dev`, so the daily R2 backup cron does not run; the container relies on Settings → Backups → Back up now and volume copies.
- Local R2 state lives in the same volume as the database, so a lost volume loses the backups with it; off-box copies are the operator's job.
- One process serves everything: no horizontal scaling, no zero-downtime restart.
- `BETTER_AUTH_SECRET` must be provided or the container exits at start.

### Revisit trigger

Revisit if Cloudflare ships a supported self-hosted runtime, or if operators outgrow the single-process model. Add a scheduler sidecar that hits the backup endpoint if daily backups in Docker become a recurring complaint.

## Pros and Cons of the Options

### Built Worker on workerd through `wrangler dev`

- Good, because it reuses the production build and runtime with no application change.
- Good, because miniflare persists D1 and R2 to a single directory.
- Bad, because `wrangler dev` is unsupported for production and has no update story.

### Cloudflare only

- Good, because it is the supported deployment and keeps cron, R2, and D1 as managed services.
- Bad, because "self-hosted" then requires a Cloudflare account, which the install docs explicitly promise against.

### Node server with `better-sqlite3` or `libsql`

- Good, because it would be a conventional, supported server target.
- Bad, because it forks the data layer from D1, doubles the runtime surface, and puts every schema change on two paths.

### `wrangler dev --remote`

- Good, because it uses real D1 and R2 bindings.
- Bad, because it still needs a Cloudflare account and credentials, which defeats the point of the container.

## Links

- [Wrangler local development](https://developers.cloudflare.com/workers/wrangler/commands/#dev)
- [Miniflare](https://developers.cloudflare.com/workers/testing/miniflare/)
- [Hostinger deploy button](https://www.hostinger.com/support/deploy-on-hostinger-button/)
- Related: [ADR-0002](0002-build-on-tanstack-start-and-cloudflare-workers.md), [ADR-0003](0003-store-data-in-cloudflare-d1-with-drizzle.md), [ADR-0014](0014-back-up-the-library-to-r2.md)
