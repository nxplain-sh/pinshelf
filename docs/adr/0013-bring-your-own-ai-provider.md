# Let users bring their own AI provider for cleanup

- Status: accepted
- Date: 2026-09-20

## Context and Problem Statement

Bookmark libraries decay: the same page gets saved twice under different URL shapes, imports arrive with no descriptions, and tags drift. Heuristics catch URL-level duplicates but not near-duplicates, and they cannot write a description or pick a sensible tag. An LLM can, but pinshelf is self-hosted: there is no pinshelf-operated backend to proxy model calls, and the operator may use OpenAI, OpenRouter, Groq, a local Ollama, or anything else.

## Decision Drivers

- No pinshelf-operated service: the model call must go from the user's Worker to the user's provider.
- Provider-agnostic: the operator chooses base URL, model, and key.
- The key is a secret and must not leak to the browser after it is saved.
- Nothing the model suggests may be applied without human review.
- The AI must not become a hard dependency: the app works fully without it.

## Considered Options

- Bring-your-own OpenAI-compatible endpoint, configured in settings
- Cloudflare Workers AI binding only
- A hosted proxy operated by the project
- Heuristic-only cleanup with no model

## Decision Outcome

Chosen option: "Bring-your-own OpenAI-compatible endpoint, configured in settings", because `/chat/completions` with a bearer token covers OpenAI, OpenRouter, Groq, Together, vLLM, and Ollama in one code path, and the operator keeps custody of both the key and the data.

Configuration (base URL, model, API key) lives in a single-row `settings` table in the operator's own D1. The key is write-only from the UI's perspective: `getAiSettings` returns only a `…last4` hint, and the key is never included in any response.

Unlike metadata fetching, the private-host guard deliberately does not apply to the AI base URL. That URL is operator configuration rather than user-supplied content, and reaching `http://localhost:11434/v1` is the entire point of supporting custom endpoints. The distinction is safe only while the app is single-user and the setting is behind an authenticated, CSRF-protected server function.

The first feature is a cleanup scan on `/cleanup`: the server sends up to 200 active bookmarks (title, URL, description, tags, collection) plus the collection list, and asks for strict JSON containing duplicate groups and metadata suggestions. The model's response is parsed with a Zod schema, then filtered so that unknown ids are dropped and a keeper can never appear in its own remove list. Nothing is applied automatically: the page lists proposals with checkboxes, and duplicates are moved to trash rather than deleted.

### Positive Consequences

- One integration covers every OpenAI-compatible provider, including local models.
- The key never round-trips to the browser after saving, and the model call is guarded against SSRF.
- Model output is validated and id-filtered, so a hallucinated id cannot touch data.
- Human review is the last step, so a bad suggestion costs a click, not a library.
- Without configuration, the feature is invisible and nothing else changes.

### Negative Consequences

- Prompt and response shapes are tuned for instruction-following models; small local models may return malformed JSON, which surfaces as an error rather than a retry.
- Bookmarks are sent to whichever provider the operator configures; privacy depends on that choice, which the settings page states.
- The AI endpoint may point at private addresses, which would be an SSRF primitive if anyone other than the owner could set it. This is why the exception is tied to the single-user model.
- The scan is a single request over a bounded batch, so very large libraries need repeated runs and the model has no memory between them.
- Cost is the operator's: a 200-bookmark scan is one large prompt, and there is no token accounting in the UI yet.

### Revisit trigger

Add streaming, token accounting, or multi-batch scanning when libraries outgrow a single scan. Move to a different API shape only if a provider the operator wants is not OpenAI-compatible. Restore the private-host guard for this setting the moment accounts, roles, or shared instances exist, because the exception depends on the only person who can set it being the owner.

## Pros and Cons of the Options

### Bring-your-own OpenAI-compatible endpoint

- Good, because one code path covers hosted and local providers.
- Good, because the operator keeps the key and the data.
- Bad, because "OpenAI-compatible" still varies in JSON-mode support and context limits.

### Workers AI binding

- Good, because no key to manage and no outbound request.
- Bad, because it locks the feature to Cloudflare's model catalogue and the operator's plan.

### Hosted proxy operated by the project

- Good, because no configuration at all.
- Bad, because it contradicts self-hosting: the project would see every bookmark sent for cleanup, and it would need billing.

### Heuristics only

- Good, because deterministic and free.
- Bad, because near-duplicates and written metadata are exactly what heuristics cannot do.

## Links

- [OpenAI chat completions API](https://platform.openai.com/docs/api-reference/chat)
- Related: [ADR-0007](0007-guard-outbound-fetches-against-ssrf.md), [ADR-0004](0004-keep-pinshelf-single-user-with-better-auth.md)
