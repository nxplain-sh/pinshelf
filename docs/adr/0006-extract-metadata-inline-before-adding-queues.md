# Extract metadata inline before adding durable queues

- Status: accepted
- Date: 2026-09-20

## Context and Problem Statement

Saving a bookmark should capture the page title, description, site name, favicon, and social image. That requires fetching the target page from the Worker. The fetch can be slow, fail, time out, or return something unexpected. Should the save request wait for metadata, or should metadata extraction be a durable background job?

## Decision Drivers

- The save response should include useful metadata when it can, so the UI never shows an untitled row for a normal page.
- A failed metadata fetch must never fail the save itself.
- Adding a queue or a cron sweep introduces bindings, retry state, and operational surface that must be justified by observed failures.
- The pipeline should be replaceable without changing the data model.

## Considered Options

- Inline fetch inside the save request, with a bounded timeout
- `waitUntil` after responding, with the bookmark in a pending state
- Cloudflare Queues with per-message retries
- Queue plus a cron-triggered sweep for stragglers

## Decision Outcome

Chosen option: "Inline fetch inside the save request, with a bounded timeout", because at current scale the fetch normally completes in well under a second, and inline extraction lets the save response carry the final title. Failures are recorded, not thrown: the bookmark is created first, then metadata is applied in a second write, and a failed fetch sets `metadata_status = 'failed'` with `metadata_attempts` incremented. The detail page offers a manual refetch button.

The schema already carries `metadata_status` and `metadata_attempts`, so moving to queued extraction is a change of execution mechanism, not of data model.

### Positive Consequences

- Saves usually return with a final, readable title.
- No queue binding, no retry bookkeeping, no consumer worker.
- Failures are visible and manually recoverable from day one.
- The outbound fetch stays inside a request that already has the SSRF guard applied.

### Negative Consequences

- A slow target site can hold the save request open for up to the 8-second timeout.
- Nothing retries automatically; a failed fetch stays failed until the user presses refetch.
- If save volume grows, slow pages become slow saves rather than dropped jobs.

### Revisit trigger

Move to `waitUntil` plus a cron sweep when either is observed: saves taking over roughly two seconds on typical pages, or a meaningful share of bookmarks stuck in `failed`. Queues are justified only when cron retries are themselves insufficient.

## Pros and Cons of the Options

### Inline fetch with bounded timeout

- Good, because metadata appears in the save response.
- Good, because there is no new infrastructure.
- Bad, because save latency inherits target-site latency.
- Bad, because there is no automatic retry.

### `waitUntil` after responding

- Good, because the response returns immediately.
- Bad, because the bookmark is briefly visible as pending, and the failure path still needs a sweep.

### Cloudflare Queues

- Good, because per-message retries and backoff come built in.
- Bad, because it is a paid binding, a consumer worker, and dead-letter handling for a workload that has not yet produced a straggler.

### Queue plus cron sweep

- Good, because it covers both retries and stragglers.
- Bad, because it is the most moving parts of all options, chosen before any measurement.

## Links

- [Cloudflare Queues](https://developers.cloudflare.com/queues/)
- [Workers `waitUntil`](https://developers.cloudflare.com/workers/runtime-apis/context/)
- Related: [ADR-0002](0002-build-on-tanstack-start-and-cloudflare-workers.md), [ADR-0007](0007-guard-outbound-fetches-against-ssrf.md)
