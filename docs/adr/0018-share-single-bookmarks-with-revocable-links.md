# Share single bookmarks with revocable public links

- Status: accepted
- Date: 2026-09-21

## Context and Problem Statement

pinshelf is single-user (ADR-0004) and every route sits behind a session. Sometimes one bookmark needs to be readable by someone else — a link sent to a colleague, a page referenced in a chat — without handing over the instance or building a sharing model. What is the smallest mechanism that shares exactly one bookmark, can be taken back, and does not weaken the single-user boundary?

## Decision Drivers

- Sharing must never expose the rest of the library, notes included, beyond the one bookmark chosen.
- A shared link must be revocable and optionally expiring; a URL that cannot be taken back is a liability.
- No new dependency and no external service.
- The public surface must be crawlable-proof (`noindex`) and render without JavaScript.

## Considered Options

- Random token rows in a `share_links` table, resolved server-side
- Signed URLs (HMAC over the bookmark id) with no database row
- A read-only API token scoped to one bookmark
- Export the bookmark as a file and share that
- No sharing at all

## Decision Outcome

Chosen option: "Random token rows in a `share_links` table", because revocation and expiry need state, and a 48-hex-character random token is not guessable.

`/s/$token` resolves the token through `resolveShareToken`, which returns nothing for revoked or expired rows, and renders a small server-side HTML page with the title, URL, description, notes, and tags. The page is `noindex`, has no session requirement, and exposes no ids: the token is the only handle. Links are created from the bookmark detail page with an optional 7- or 30-day expiry, listed there, and revoked with one click. Each bookmark is capped at five live links.

### Positive Consequences

- Exactly one bookmark is reachable per link, with no navigation into the library.
- Revocation is immediate (a database row), and expiry is enforced at resolution time.
- No new dependency; the token is `crypto.getRandomValues` output.
- The shared page works without JavaScript and is excluded from search engines.

### Negative Consequences

- Anyone with the URL can read that bookmark, including notes; there is no password on a link.
- Tokens are stored in plain text, so a database leak exposes live links until revoked.
- There is no view counter or audit trail of who opened a link.
- Deleting a bookmark deletes its links (cascade), which silently breaks shared URLs.
- The public page is plain HTML: no styling beyond inline CSS and no archived snapshot link.

### Revisit trigger

Add a password or an expiry cap if links are shared outside small groups. Add an access counter when operators ask whether a link was opened. Move to signed URLs only if the table becomes a maintenance burden.

## Links

- Related: [ADR-0004](0004-keep-pinshelf-single-user-with-better-auth.md), [ADR-0010](0010-expose-a-token-authenticated-rest-api.md), [ADR-0017](0017-archive-pages-into-r2-as-untrusted-html.md)
