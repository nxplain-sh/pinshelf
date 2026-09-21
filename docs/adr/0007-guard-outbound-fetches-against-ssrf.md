# Guard every outbound fetch of user-supplied URLs against SSRF

- Status: accepted
- Date: 2026-09-20

## Context and Problem Statement

pinshelf fetches pages from URLs the user supplies, server-side, to extract metadata. A user-supplied URL is a trust boundary: a hostile or careless URL can point at loopback, link-local, or private-network addresses, turning the Worker into a request forwarder for whatever the URL can reach. What guard is proportionate for a self-hosted app whose owner is also the only user?

## Decision Drivers

- The owner is the only user today, but the same code path becomes multi-user the moment accounts are added, and it must already be safe then.
- The guard must be testable without network access.
- Cloudflare does not route Worker fetches into private networks, which is a backstop, not a licence to skip validation.
- Blocked hosts must fail fast and visibly, not silently produce empty metadata that looks like a parsing bug.

## Considered Options

- Rely on the Cloudflare platform to refuse private-address fetches
- Literal hostname and IP blocklist validated before every fetch hop
- DNS resolution followed by validated-IP fetch (pinning)
- Proxy all fetches through an external sanitizing service

## Decision Outcome

Chosen option: "Literal hostname and IP blocklist validated before every fetch hop", because it is fully testable, costs microseconds, and stacks on top of the platform backstop.

`isBlockedHostname` in `packages/shared` rejects loopback, private, carrier-grade NAT, and link-local IPv4 ranges, IPv6 loopback and unique-local prefixes, `localhost` and `.localhost`, and the `.local`, `.internal`, and `.home.arpa` suffixes. Redirects are followed manually, at most five hops, and every hop is validated before its request is issued. Only `http:` and `https:` URLs are accepted at input time, so schemes like `file:` never reach the fetcher. A refused host throws, which the save path records as `metadata_status = 'failed'`.

### Positive Consequences

- The guard is a pure function with unit tests, independent of Workers runtime behaviour.
- Redirect chains cannot escape the blocklist by pointing at a private address on hop two.
- Blocked fetches are attributable: the failure is recorded on the bookmark and retryable after a fix.

### Negative Consequences

- Hostname checks cannot see DNS rebinding: a public hostname resolving to `127.0.0.1` passes the guard. The platform backstop is what covers this; a resolve-and-pin approach would be needed to cover it in application code.
- The blocklist is a denylist of known-private shapes rather than an allowlist of public ones, so novel internal naming schemes are not caught. This favours usability for self-hosters with unusual internal domains.
- A legitimate bookmark to a private address (an intranet page) cannot have metadata extracted, only saved.

## Pros and Cons of the Options

### Rely on the platform

- Good, because zero code.
- Bad, because platform behaviour is not a contract, is not testable here, and would silently change.

### Literal blocklist validated per hop

- Good, because testable, cheap, and catches the common cases including redirects.
- Bad, because DNS rebinding and unusual internal names are out of reach.

### DNS resolution plus validated-IP fetch

- Good, because it closes rebinding by pinning the resolved address.
- Bad, because Workers does not expose a resolver without `nodejs_compat` gymnastics, and the platform already refuses private-address connects.

### External proxy service

- Good, because isolation is someone else's problem.
- Bad, because it adds a vendor, a cost, and a new trust relationship for a personal bookmark app.

## Links

- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- Related: [ADR-0006](0006-extract-metadata-inline-before-adding-queues.md)
