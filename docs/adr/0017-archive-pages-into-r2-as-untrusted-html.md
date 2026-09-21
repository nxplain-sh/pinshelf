# Archive pages into R2 as untrusted HTML snapshots

- Status: accepted
- Date: 2026-09-21

## Context and Problem Statement

A bookmark points at a page that can move, change, or disappear. pinshelf already notices when a link stops answering (ADR-0016 era link checks), but noticing is not keeping: the content itself is gone. The library lives in D1 and backups live in R2, so there is somewhere to put a copy — the questions are what to store, how to serve it back without turning the app into an open redirect for hostile HTML, and how to keep the cost bounded.

## Decision Drivers

- The snapshot must survive the original page disappearing; storing a URL list is not enough.
- Serving archived HTML means serving attacker-controlled content from our own origin; that must not be able to run scripts or reach the app's session.
- R2 is already bound (`BACKUPS`) and inside the operator's account, so no new service.
- A personal library does not need versioned snapshots or full WARC fidelity.
- The fetch must go through the same SSRF guard as metadata extraction, not a second copy of it.

## Considered Options

- Raw HTML snapshot in R2, served in a sandboxed viewer
- Readability-extracted text or Markdown instead of raw HTML
- Versioned snapshots with diffs (archive.org style)
- Screenshot images (PDF or PNG)
- Rely on the Internet Archive's "Save Page Now" instead of storing anything

## Decision Outcome

Chosen option: "Raw HTML snapshot in R2, served in a sandboxed viewer", because it preserves the page as published, costs one R2 object per bookmark, and the sandbox CSP contains the risk.

`fetchHtml` in `lib/metadata.server.ts` became exported and is reused, so archived fetches inherit the per-hop SSRF guard and redirect limit. The response body is capped at 2MB, written to `archives/<bookmark-id>.html`, and the row records `archiveKey`, `archiveStatus`, and `archivedAt`. One snapshot per bookmark: archiving again overwrites. Deleting a bookmark deletes its object. The viewer at `/archive/$id` requires a session and serves the object with `Content-Security-Policy: sandbox; default-src none`, `nosniff`, and private caching.

### Positive Consequences

- A saved page stays readable after the site changes or dies, and the snapshot lives in the operator's own bucket.
- Untrusted HTML cannot run scripts, submit forms, or read the app's origin: the sandbox CSP denies everything.
- Snapshot size and count are bounded by the 2MB cap and one object per bookmark, so R2 cost stays trivial.
- The fetch path is the same audited one metadata uses; no second SSRF surface.

### Negative Consequences

- Relative asset URLs inside the snapshot resolve against our origin and 404, so images and stylesheets from the original site are usually missing. The snapshot is text and structure, not a pixel-perfect copy.
- Pages that render client-side show only their shell.
- Archiving is on demand per bookmark; there is no bulk archive, no scheduling, and no automatic archive on save.
- A second archive overwrites the first, so there is no history of how a page changed.
- 2MB of HTML can still be mostly markup; there is no text extraction, so archived content is not searchable.

### Revisit trigger

Add text extraction (and index it in FTS) when searching inside snapshots is asked for. Add bulk or automatic archiving when operators archive more than a handful of pages by hand. Move to a WARC-style format only if fidelity requirements appear; screenshots only if visual fidelity matters more than text.

## Links

- [Cloudflare R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/)
- [CSP: sandbox](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/sandbox)
- Related: [ADR-0007](0007-guard-outbound-fetches-against-ssrf.md), [ADR-0014](0014-back-up-the-library-to-r2.md)
