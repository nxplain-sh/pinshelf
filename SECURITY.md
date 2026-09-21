# Security Policy

## Supported versions

pinshelf is pre-1.0. Only the latest commit on `main` is supported. There are no maintained release branches yet.

## Reporting a vulnerability

Do not open a public issue for a security problem. Use GitHub private vulnerability reporting:

1. Go to the repository's **Security** tab.
2. Choose **Report a vulnerability**.
3. Describe the issue, the impact, and the steps to reproduce, or a proof of concept if you have one.

If private reporting is unavailable to you, open a minimal public issue that says only that you need a private channel, with no technical detail, and a maintainer will follow up.

You can expect an acknowledgement within a few days. Please give a reasonable window for a fix and a release before publishing anything.

## Security model

pinshelf is designed for single-user self-hosting. The relevant properties, so you know what is and is not defended:

- **Single user by construction.** Signup works only while the database has zero users. The first account becomes the owner. A database-level unique index makes a second user row impossible even under race conditions.
- **Sessions and credentials.** Authentication is delegated to Better Auth (email/password), which owns password hashing, session tokens, and cookies. The browser extension authenticates with an API key issued by the apiKey plugin, never with a copied session cookie. API keys are bearer tokens with full access to bookmarks until revoked at `/settings`; they have no scopes yet (see [ADR-0010](docs/adr/0010-expose-a-token-authenticated-rest-api.md)). API key rate limiting is set explicitly to 300 requests per minute per key, because the plugin default of 10 per day would break normal extension use.
- **Secrets.** `BETTER_AUTH_SECRET` lives in `apps/web/.dev.vars` locally and in Cloudflare secrets (`wrangler secret put`) in production. `.dev.vars` is gitignored; `.dev.vars.example` contains no real values.
- **Outbound fetches.** The metadata pipeline fetches user-supplied URLs server-side. Every hop, including redirects, is validated against a private/loopback/link-local address blocklist before the request is issued, and only `http:` and `https:` are accepted. See [ADR-0007](docs/adr/0007-guard-outbound-fetches-against-ssrf.md) for the known limits (DNS rebinding is covered by platform behaviour, not by application code).
- **Data ownership.** A self-hosted instance stores everything in the operator's own Cloudflare account. There is no pinshelf-operated backend, no telemetry, and no third-party analytics.
- **Server functions require a session.** The web UI talks to the server through server functions, which are reachable over HTTP at a predictable URL. The CSRF check only proves the caller is same-origin, which any script can fake, so every data server function authenticates explicitly through `requireSession` middleware. The only public ones are `fetchSession` and `fetchSetupState`, which the login page needs before a session exists. The REST API has its own bearer-token check.
- **Backups.** Daily JSON snapshots live in an R2 bucket in the operator's own account. A snapshot contains the whole library, notes included, so the bucket is as sensitive as the database: grant access only through the Worker binding, and do not share bucket credentials. Restoring is additive and never overwrites existing bookmarks.
- **AI provider key.** When AI cleanup is configured, the provider API key is stored in the operator's own D1 database and is write-only from the UI: the server returns only a `…last4` hint and never echoes the key back. Outbound model calls go directly from the Worker to the configured base URL. The private-host guard does not apply there, on purpose: the base URL is owner configuration, and local models such as Ollama or vLLM are a supported setup. That exception is safe only while the app is single-user and the setting sits behind an authenticated server function. Bookmarks in the scanned batch are sent to whichever provider the operator chose; the settings page says so before you configure it. See [ADR-0013](docs/adr/0013-bring-your-own-ai-provider.md).
- **Dependencies.** Renovate watches npm dependencies and GitHub Actions, holds major updates for approval, and pins actions by digest. Install scripts run only for explicitly approved packages (`allowBuilds` in `pnpm-workspace.yaml`).

## Out of scope

- Vulnerabilities in Cloudflare's platform, Better Auth, or other third-party dependencies. Report those upstream; we will pick up fixed versions.
- Anything requiring an attacker to already control the operator's Cloudflare account, GitHub account, or local machine.
- Findings that require the attacker to be the instance owner (the owner can already read and delete everything).
- Missing hardening headers or best-practice suggestions with no demonstrated impact. These are welcome as normal issues, not as vulnerability reports.

## Hardening checklist for operators

- Generate `BETTER_AUTH_SECRET` with `openssl rand -base64 32`; never reuse a value from a repository or another service.
- If you use a root `.env` for `CLOUDFLARE_API_TOKEN`, scope the token to Workers Scripts (Edit) and D1 (Edit) on the one account, and never commit it. Prefer `wrangler login` locally.
- Enable GitHub private vulnerability reporting on forks you maintain.
- Keep the Worker updated (`pnpm deploy`) after dependency updates that touch auth.
- Do not enable Cloudflare Access in front of the Worker unless you also keep the API key path working for the extension.

## No bug bounty

There is no paid bounty program. Credit is given in the release notes for confirmed reports unless you prefer otherwise.
