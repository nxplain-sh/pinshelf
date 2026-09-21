# Adopt pnpm workspaces and Turborepo for the monorepo

- Status: accepted
- Date: 2026-09-20

## Context and Problem Statement

pinshelf ships several deliverables that share types and logic: a web application, a browser extension, and at least one shared package for URL normalization, security guards, and API types. They live in one repository so that a schema change, an API change, and both clients change in one commit. Which package manager and task runner keeps that arrangement fast and honest?

## Decision Drivers

- Workspace linking that fails loudly when an undeclared dependency is imported.
- One command to run build, typecheck, and tests across every package.
- Caching that pays off in CI without remote-cache setup.
- Tooling that matches TanStack, Cloudflare, and Turborepo documentation, which all default to pnpm.
- Minimal supply-chain risk from package install scripts.

## Considered Options

- pnpm workspaces + Turborepo
- npm workspaces, no task runner
- npm workspaces + Turborepo
- Yarn Berry with PnP

## Decision Outcome

Chosen option: "pnpm workspaces + Turborepo", because pnpm gives strict, non-flat linking with an explicit `workspace:*` protocol and a build-script allowlist (`allowBuilds`), while Turborepo adds a task graph and local caching for a cost of one config file.

### Positive Consequences

- Importing an undeclared package fails immediately instead of working on the author's machine and breaking in CI.
- `pnpm dev` starts every dev server through one graph; `turbo build typecheck test` is the CI contract.
- Install scripts for dependencies such as `esbuild` and `workerd` run only when explicitly approved.
- `packages/shared` needs no build step: both apps are Vite-based and import its TypeScript source directly.

### Negative Consequences

- Two tools to keep current instead of one.
- pnpm version is pinned through `packageManager` and assumed by contributors; corepack or a compatible pnpm is required.
- Local `turbo` caching needs a `.turbo` directory in `.gitignore` and can confuse debugging after stale outputs (rare, mitigated by correct `outputs` globs).

## Pros and Cons of the Options

### pnpm workspaces + Turborepo

- Good, because strict linking catches phantom dependencies.
- Good, because `workspace:*` cannot silently resolve from the registry.
- Good, because task graph expands cleanly as `apps/extension` arrives.
- Bad, because Turborepo is redundant at two packages; it earns its place from Phase 3 onward.

### npm workspaces, no task runner

- Good, because npm ships with Node, zero install.
- Bad, because hoisted `node_modules` hides missing dependency declarations.
- Bad, because cross-package scripts become hand-written `npm -ws run` chains.

### npm workspaces + Turborepo

- Good, because Turborepo works with npm.
- Bad, because the linking and script-allowlist gaps remain.

### Yarn Berry with PnP

- Good, because PnP removes `node_modules` entirely and is fast.
- Bad, because PnP fights editors, bundlers, and some Cloudflare tooling more than it pays here.

## Links

- [pnpm settings reference](https://pnpm.io/settings)
- [Turborepo documentation](https://turborepo.com/docs)
- Related: [ADR-0002](0002-build-on-tanstack-start-and-cloudflare-workers.md)
