# Serve the library over MCP as well as REST

- Status: accepted
- Date: 2026-09-21

## Context and Problem Statement

pinshelf already exposes a token-authenticated REST API (ADR-0010) so the extension and scripts can read and write bookmarks. Users who want to _talk_ to their library — summarise, reorganise, rediscover — otherwise need pinshelf to build its own chat UI, conversation storage, embeddings, and a vector store, and to ship a second model integration. Raindrop's Stella shows the demand for that workflow, but also that it can be served without owning the chat surface: their equivalent is an MCP server that hands the library to ChatGPT, Claude, and other assistants.

How should pinshelf make its library available to those assistants without growing a chat client?

## Decision Drivers

- Single-user, self-hosted instance: no account system, no per-user conversations to store.
- Bring-your-own-model (ADR-0013) already exists; a chat feature would duplicate the provider plumbing for a worse UI than the assistants users already have.
- The REST API already has token scopes (`read`/`write`) and handler-level validation worth reusing.
- No new infrastructure: D1, R2, and the Worker only.

## Considered Options

1. Build a chat UI in the app with conversation history and embeddings.
2. Stateless MCP endpoint at `/mcp` that wraps the existing server functions and authenticates with the existing API tokens.
3. Do nothing; point users at the REST API and let them write their own glue.

## Decision Outcome

Chosen option: "stateless MCP endpoint at `/mcp`", because it reuses the token model, the JSON-RPC surface is small enough to implement without a dependency, and the user's own assistant supplies the chat experience, history, and model choice.

The endpoint accepts JSON-RPC 2.0 over `POST` with a Bearer API token, implements `initialize`, `tools/list`, `tools/call`, and the initialized notification, and answers `GET` with `405` rather than offering SSE. Tools are `search_bookmarks`, `get_bookmark`, `list_collections`, `list_tags`, `save_bookmark`, `update_bookmark`, and `set_status`; read tools require the `read` scope and write tools additionally require `write`, exactly as the REST API does.

### Positive Consequences

- No chat UI, no conversation tables, no embeddings, and no vector store to operate.
- Tokens, scopes, and rate limiting are shared with the REST API, so there is one auth story.
- Works with any assistant that speaks streamable HTTP MCP, including local ones pointing at a self-hosted instance.

### Negative Consequences

- Stateless means no server-initiated messages, sampling, or progress notifications; a future interactive flow would need sessions.
- The tool surface must be kept in step with the REST API by hand; the OpenAPI document does not describe it.
- MCP itself is moving quickly, so the protocol subset needs revisiting when clients require newer capabilities.

## Links

- Extends [ADR-0010](0010-expose-a-token-authenticated-rest-api.md) to MCP-speaking clients.
- Relates to [ADR-0013](0013-bring-your-own-ai-provider.md) for the model the assistant runs.
