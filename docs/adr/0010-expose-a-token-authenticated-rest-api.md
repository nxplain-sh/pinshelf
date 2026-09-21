# Expose a token-authenticated REST API for non-browser clients

- Status: accepted
- Date: 2026-09-20

## Context and Problem Statement

The browser extension cannot use the web session cookie: it runs on its own origin, has no login form, and must survive browser restarts without a re-auth flow. It needs a durable credential and a stable HTTP interface. The same interface will serve future clients (mobile shortcuts, scripts, importers). What should that interface be, and how is it authenticated?

## Decision Drivers

- The extension must save a page in one request without a browser redirect or cookie.
- Credentials must be revocable per client and never be the account password.
- The API must be usable from `curl` for debugging and self-host verification.
- No CORS surface beyond what the extension needs.
- Reuse the data layer that the web UI already uses, so behaviour cannot diverge.

## Considered Options

- REST routes under `/api/*` authenticated with Better Auth API keys (bearer tokens)
- Session cookies forwarded from the browser
- OAuth device flow or a full OAuth provider
- Server functions only, called through the extension's own embedded page

## Decision Outcome

Chosen option: "REST routes under `/api/*` authenticated with Better Auth API keys", because it is one credential per client, revocable from the settings page, verified server-side by the plugin that already owns the API key table, and testable with `curl`.

Routes: `GET|POST /api/bookmarks`, `GET|PATCH|DELETE /api/bookmarks/$id`, `GET /api/collections`, `GET /api/tags`. Every handler calls `authorizeApiRequest`, which requires `Authorization: Bearer <key>` and delegates verification to `auth.api.verifyApiKey`. Missing or invalid tokens get `401` with a JSON body; validation failures get `400`; unknown ids get `404`.

The extension declares `host_permissions` for the instance origin, which lets it call the API without CORS preflight. No `Access-Control-Allow-*` headers are sent, so a random web page cannot use a token even if one leaks into a browser context.

Both the routes and the web UI call the same data-layer functions in `src/lib/bookmarks.ts` and `src/lib/taxonomy.ts`; the server functions are thin wrappers over those functions. This is the property that keeps the two surfaces honest.

### Positive Consequences

- One revocable credential per client, listed and revocable at `/settings`.
- The API is debuggable with `curl` and therefore verifiable for self-hosters.
- Extension and web cannot drift in behaviour, because both call the same functions.
- Adding another client (Shortcut, CLI, importer) needs no new auth mechanism.

### Negative Consequences

- API keys are bearer tokens: whoever holds one has full access to all bookmarks until it is revoked. There are no scopes or per-collection limits yet.
- The extension stores the key in `browser.storage.local`, which is readable by anyone with access to the browser profile.
- Rate limiting is whatever the Better Auth apiKey plugin defaults to; there is no per-route budget.
- The REST surface must be treated as public API from now on; changing response shapes is a breaking change for installed extensions.

### Revisit trigger

Add scopes when a client needs less than full access (for example a read-only widget), and add a device-flow login if typing a token into an extension ever becomes the top support complaint.

## Pros and Cons of the Options

### REST + API keys

- Good, because revocation and listing come from the existing plugin and settings page.
- Good, because it works from any HTTP client.
- Bad, because the credential is powerful and long-lived.

### Session cookies

- Good, because zero new auth code.
- Bad, because an extension cannot obtain or refresh a web session without embedding a login form, and cookies do not survive profile changes predictably.

### OAuth device flow

- Good, because it is the most user-friendly path for native and extension clients.
- Bad, because it needs an OAuth provider surface, consent screens, and token storage for a single-user self-hosted app.

### Server functions only

- Good, because no new HTTP surface.
- Bad, because server functions are an implementation detail of the web app, not a stable contract, and their wire format (seroval) is not meant for third parties.

## Links

- [Better Auth apiKey plugin](https://www.better-auth.com/docs/plugins/api-key)
- Related: [ADR-0004](0004-keep-pinshelf-single-user-with-better-auth.md), [ADR-0005](0005-ship-pwa-and-extension-before-native-shells.md)
