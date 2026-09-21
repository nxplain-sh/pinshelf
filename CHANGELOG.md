# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Static site in `site/`: landing page, install docs, and a 404 page, served from `pinshelf.app` as a Worker that adds security headers (`make site-dev`, `make site-deploy`).
- An `archived` bookmark status alongside `active` and `trashed`, with an archived view, row actions, and API support.
- Keyboard-first navigation: a `cmd/ctrl + k` command palette, `j`/`k`/`enter`/`x`/`t`/`a` list shortcuts, and a `?` shortcut overlay.
- Daily maintenance in the cron: metadata retries for failed saves and link checks that flag broken pages after 30 days.
- A non-AI duplicate finder on `/cleanup` that groups urls differing only by query string, fragment, or trailing slash.
- Tag rename and merge in Settings → Tags, with the search index rebuilt for affected bookmarks.
- Markdown export (`download markdown`) alongside JSON and Netscape HTML.
- A PWA share target: sharing a link opens `/share` with the URL prefilled.
- `GET /api/health`, unauthenticated, used by the container healthcheck.
- Rate limiting for sign-in and second-factor verification, stored in D1.
- Optional TOTP two-factor authentication with one-time backup codes, plus a session list that can revoke devices.
- Two-factor enrollment shows a locally rendered QR code, counts down from ten minutes, deletes the pending secret when it expires, and supports regenerating and discarding a code.
- API token scopes and expiry: read-only tokens are rejected with `403` on write routes.
- Page snapshots: archive a bookmark's HTML into R2 and read it back from a sandboxed viewer (ADR-0017).
- Public, revocable share links for single bookmarks with optional expiry (ADR-0018).
- Saved searches: name a filtered view and bring it back in one click.
- An `/insights` page: status counts, upkeep warnings, saves per month, top hosts, top tags.
- Configurable backup retention (7–365 snapshots) in Settings.
- Highlights: keep a passage and an optional note on a bookmark.
- AI cleanup scans large libraries in batches of 50 and reports batch and token counts.
- `tidy unsorted` in AI cleanup: scans only bookmarks without a collection (up to 500), requires a collection for each, and reports what stayed unassigned.
- Smart filters: a `smart` button turns a plain-language request into validated search filters.
- Smart collections: the collections page lists saved-search filters and can suggest new ones for review.
- The bookmark list is cached per filter set for offline reading, with a staleness banner.
- Security headers on app responses (`frame-ancestors 'none'`, nosniff, frame deny, referrer policy, permissions policy); the static site sets a full CSP.
- Contrast and header checks for the static site, run as part of `make check`.
- Container self-hosting: `Dockerfile`, `docker-entrypoint.sh`, and `compose.yaml` run the built Worker on workerd with the database and backups in one volume. The image is published to GHCR by `.github/workflows/docker.yml`, and the site and README carry a Deploy on Hostinger button. See [ADR-0016](docs/adr/0016-self-host-with-docker-on-workerd.md).

### Changed

- The app now answers on `app.pinshelf.app`; `pinshelf.app` serves the static site. `BETTER_AUTH_URL`, the extension's default API URL and host permissions, and the metadata user agent all follow. See [ADR-0015](docs/adr/0015-serve-the-project-site-from-the-apex-domain.md).
- `make icons` now also copies the brand files into `site/public/assets`.
- Workspace scripts call the TypeScript 6 alias's `tsc6` binary instead of a `tsc` that resolved only on machines with a global install.
