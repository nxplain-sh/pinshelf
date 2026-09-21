# Use TanStack Query for client data and mutations

- Status: accepted
- Date: 2026-09-20

## Context and Problem Statement

Until now every route loader called a server function and every mutation called `router.invalidate()`, which refetched the whole route. That worked, but it produced no optimistic feedback, no per-key caching, no background refetch, and it made the UI wait for a full round trip before showing a trashed bookmark as gone. The data-fetching story was the least idiomatic part of an otherwise TanStack-based app.

## Decision Drivers

- Mutations should feel instant: trashing or deleting a row should not wait on the server.
- Cached data should be reusable across routes without duplicating loader logic.
- SSR must keep working: the first paint should still be server-rendered with data, not a client fetch waterfall.
- One data-fetching pattern, not two competing ones.
- Type safety from server function to component without hand-written DTOs.

## Considered Options

- Keep route loaders plus `router.invalidate()`
- TanStack Query for client data, with loaders as the SSR seed
- TanStack Query with no route loaders (fetch on the client only)
- A different cache library (SWR, RTK Query)

## Decision Outcome

Chosen option: "TanStack Query for client data, with loaders as the SSR seed", because it keeps server rendering and adds the cache behaviour the app was missing.

The `QueryClient` is created in `getRouter()` and placed in the router context; `setupRouterSsrQueryIntegration` from `@tanstack/react-router-ssr-query` handles dehydration and hydration. Loaders call `queryClient.ensureQueryData` with a key from `src/lib/queries.ts`, components read the same key with `useSuspenseQuery`, and mutations are hooks in that same module. Every mutation invalidates the keys it affects; trashing, restoring, and deleting also update the list cache optimistically and roll back on error.

## Positive Consequences

- Trash, restore, and delete are instant in the UI, with rollback if the request fails.
- Query keys are defined once; a mutation cannot forget to invalidate a related view without it being visible in one file.
- SSR still renders data on first paint, and the client hydrates without a refetch when the cache is fresh (`staleTime` 30 s).
- Signing out clears the query cache, so a second session cannot read the first one's data from memory.

## Negative Consequences

- Two layers to understand: router loaders for navigation-time data and the query cache for component data. The rule is "loaders ensure, components read, mutations invalidate", but it must be learned.
- Cache invalidation is now a discipline rather than an automatic consequence of navigation. A missed key means stale UI until the next refetch.
- `@tanstack/react-query` adds bundle weight to the client.
- Optimistic updates duplicate a little filtering logic that also exists on the server (`onMutate` removes rows locally).

### Revisit trigger

If loader/query duplication starts producing bugs, collapse to one pattern: either move all fetching into loaders, or drop loaders and fetch in components with the query cache as the only source.

## Pros and Cons of the Options

### Loaders plus `router.invalidate()`

- Good, because one concept and no extra dependency.
- Bad, because every mutation refetches the route and the UI waits for it.

### Query with loaders as the SSR seed

- Good, because SSR and cache behaviour both work.
- Good, because mutations get optimistic updates and rollback.
- Bad, because two layers must be kept in sync by convention.

### Query without loaders

- Good, because a single source of truth for client data.
- Bad, because the first paint loses server-rendered data unless every route is careful with suspense and streaming.

### SWR or RTK Query

- Good, because both are mature.
- Bad, because the app is already TanStack-shaped; a second paradigm adds friction for no capability gain.

## Links

- [TanStack Query documentation](https://tanstack.com/query/latest)
- [Router SSR Query integration](https://tanstack.com/router/latest/docs/framework/react/guide/ssr-query-integration)
- Related: [ADR-0002](0002-build-on-tanstack-start-and-cloudflare-workers.md)
