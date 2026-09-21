import { beforeAll, describe, expect, it } from 'vitest'
import { auth } from '../src/lib/auth.server'
import { createBookmarkRecord } from '../src/lib/bookmarks.server'
import { handleMcpRequest } from '../src/lib/mcp.server'

let token = ''
let ownerId = ''

function rpc(
  body: Record<string, unknown>,
  init: { anonymous?: boolean; key?: string } = {},
): Request {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (!init.anonymous) {
    headers.set('authorization', `Bearer ${init.key ?? token}`)
  }
  return new Request('http://pinshelf.test/mcp', {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', ...body }),
  })
}

beforeAll(async () => {
  const created = await auth.api.signUpEmail({
    body: { name: 'Owner', email: 'mcp@test.local', password: 'test-password-123' },
  })
  ownerId = created.user.id
  const key = await auth.api.createApiKey({
    body: { name: 'mcp', userId: ownerId, rateLimitEnabled: false },
  })
  token = key.key
})

describe('mcp endpoint', () => {
  it('rejects requests without a token', async () => {
    const response = await handleMcpRequest(
      rpc({ id: 1, method: 'tools/list' }, { anonymous: true }),
    )
    expect(response.status).toBe(401)
  })

  it('answers initialize with the protocol version and server name', async () => {
    const response = await handleMcpRequest(rpc({ id: 1, method: 'initialize' }))
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      result: { protocolVersion: string; serverInfo: { name: string } }
    }
    expect(body.result.protocolVersion).toBe('2025-06-18')
    expect(body.result.serverInfo.name).toBe('pinshelf')
  })

  it('accepts the initialized notification without a body', async () => {
    const response = await handleMcpRequest(rpc({ method: 'notifications/initialized' }))
    expect(response.status).toBe(202)
  })

  it('lists tools with input schemas', async () => {
    const response = await handleMcpRequest(rpc({ id: 2, method: 'tools/list' }))
    const body = (await response.json()) as {
      result: { tools: { name: string; inputSchema: { type: string } }[] }
    }
    const names = body.result.tools.map((tool) => tool.name)
    expect(names).toContain('search_bookmarks')
    expect(names).toContain('save_bookmark')
    for (const tool of body.result.tools) {
      expect(tool.inputSchema.type).toBe('object')
    }
  })

  it('calls a read tool', async () => {
    await createBookmarkRecord({ url: 'https://example.com/mcp-search-target' })
    const response = await handleMcpRequest(
      rpc({
        id: 3,
        method: 'tools/call',
        params: {
          name: 'search_bookmarks',
          arguments: { q: 'mcp-search-target' },
        },
      }),
    )
    const body = (await response.json()) as {
      result: { isError: boolean; content: { text: string }[] }
    }
    expect(body.result.isError).toBe(false)
    expect(body.result.content[0].text).toContain('mcp-search-target')
  })

  it('refuses a write tool on a read-only token', async () => {
    const readOnly = await auth.api.createApiKey({
      body: {
        name: 'mcp-read-only',
        userId: ownerId,
        permissions: { bookmarks: ['read'] },
        rateLimitEnabled: false,
      },
    })
    const response = await handleMcpRequest(
      rpc(
        {
          id: 4,
          method: 'tools/call',
          params: {
            name: 'save_bookmark',
            arguments: { url: 'https://example.com/denied' },
          },
        },
        { key: readOnly.key },
      ),
    )
    expect(response.status).toBe(403)
  })

  it('applies a write tool with a write token', async () => {
    const response = await handleMcpRequest(
      rpc({
        id: 5,
        method: 'tools/call',
        params: {
          name: 'save_bookmark',
          arguments: { url: 'https://example.com/mcp-saved' },
        },
      }),
    )
    const body = (await response.json()) as {
      result: { isError: boolean; content: { text: string }[] }
    }
    expect(body.result.isError).toBe(false)
    expect(body.result.content[0].text).toContain('mcp-saved')
  })

  it('reports unknown tools as an error result, not a crash', async () => {
    const response = await handleMcpRequest(
      rpc({ id: 6, method: 'tools/call', params: { name: 'nope', arguments: {} } }),
    )
    const body = (await response.json()) as { error: { message: string } }
    expect(body.error.message).toContain('unknown tool')
  })

  it('rejects GET', async () => {
    const response = await handleMcpRequest(
      new Request('http://pinshelf.test/mcp', { method: 'GET' }),
    )
    expect(response.status).toBe(405)
  })
})
