# Keep pinshelf single-user and authenticate with Better Auth

- Status: accepted
- Date: 2026-09-20

## Context and Problem Statement

pinshelf v1 is a self-hosted bookmark manager for one person. That person still needs to log in from a browser, and the browser extension needs a credential that does not depend on a browser session cookie. How should authentication work without hand-rolling session cryptography, and how should "exactly one user" be enforced?

## Decision Drivers

- Self-host first run must not require configuring an identity provider.
- The browser extension needs a stable API credential, not a copied session cookie.
- Authentication is a trust boundary: no custom crypto, no custom session format.
- Login must remain portable if the app ever moves off Cloudflare.
- Implementation must fit the Workers runtime.

## Considered Options

- Better Auth with email and password plus its API key plugin
- Cloudflare Access in front of the Worker
- Hand-rolled session cookies with a signed token
- A hosted auth service such as Clerk or Auth0

## Decision Outcome

Chosen option: "Better Auth with email and password plus the API key plugin", because it provides sessions, password hashing, cookie handling, and extension API keys as one maintained dependency, works on Workers with the Drizzle adapter against D1, and stays portable.

The first signup becomes the owner account: when zero users exist the login page renders a setup form, and afterwards signups are rejected. Enforcement is deliberately doubled: a `databaseHooks.user.create.before` hook returns `false` when a user exists, and a unique expression index `user_singleton ON user((1))` makes a second row impossible at the database level even if two requests race.

### Positive Consequences

- No hand-rolled password hashing, session tokens, or cookie serialization.
- The API key plugin gives the extension `Authorization: Bearer <key>` credentials scoped to the owner.
- Zero external login dependencies for self-hosters; the first-run experience is a local form.
- The database-level singleton constraint does not rely on application code being correct.

### Negative Consequences

- Better Auth is a large dependency; it accounts for most of the server bundle weight on Workers.
- The auth schema (user, session, account, verification, apikey) is owned by the library; upgrades must be checked against the checked-in Drizzle schema.
- Adding multi-user later is a schema and policy change, which is why it needs this ADR to be superseded rather than silently extended.

## Pros and Cons of the Options

### Better Auth with email/password and API keys

- Good, because sessions, password hashing, and API keys arrive as one maintained package.
- Good, because the Drizzle adapter maps onto the existing schema workflow.
- Good, because it runs on Workers with `nodejs_compat`.
- Bad, because of dependency weight and upgrade coupling.

### Cloudflare Access in front of the Worker

- Good, because auth happens before the request reaches application code.
- Bad, because the extension cannot ride an Access session cleanly, so an API token path is still required.
- Bad, because self-hosting now requires Cloudflare Zero Trust configuration and an identity provider.
- Bad, because portability off Cloudflare is lost.

### Hand-rolled session cookies

- Good, because it is a few dozen lines and no dependency.
- Bad, because rolling your own session and CSRF handling is exactly the mistake this decision exists to avoid.

### Hosted auth service (Clerk, Auth0)

- Good, because the operational burden is theirs.
- Bad, because a self-hosted app should not depend on a third-party login service being reachable and free.

## Links

- [Better Auth documentation](https://www.better-auth.com/docs)
- [Better Auth apiKey plugin](https://www.better-auth.com/docs/plugins/api-key)
- Related: [ADR-0003](0003-store-data-in-cloudflare-d1-with-drizzle.md)
