import { authorizeApiRequest, badRequest } from '~/lib/api.server'
import type { ApiScope } from '~/lib/api.server'
import {
  createBookmarkRecord,
  getBookmarkById,
  queryBookmarks,
  setBookmarkStatus,
  updateBookmarkRecord,
} from '~/lib/bookmarks.server'
import type { BookmarkFilters, BookmarkStatus } from '~/lib/bookmarks.types'
import { createHighlight, listHighlights } from '~/lib/highlights.server'
import { askBookmark } from '~/lib/ai.server'
import type { AskMode } from '~/lib/ai-schemas'
import { queryCollections, queryTags } from '~/lib/taxonomy.server'

/**
 * Stateless MCP endpoint (ADR-0019): JSON-RPC over POST, no sessions, no SSE.
 * Tools are a thin wrapper over the same server functions the REST API uses,
 * so scopes and semantics cannot drift between the two surfaces.
 */
const PROTOCOL_VERSION = '2025-06-18'

type Tool = {
  name: string
  description: string
  scope: ApiScope
  inputSchema: Record<string, unknown>
  run: (args: Record<string, unknown>) => Promise<unknown>
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function optionalText(value: unknown): string | undefined {
  const result = text(value).trim()
  return result || undefined
}

function idList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []
}

const STATUSES: BookmarkStatus[] = ['active', 'archived', 'trashed']
const ASK_MODES: AskMode[] = ['summary', 'takeaways', 'plain', 'verdict']

export const TOOLS: Tool[] = [
  {
    name: 'search_bookmarks',
    description: 'Search the library by text, tag, collection, or status.',
    scope: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'full-text query' },
        tag: { type: 'string' },
        collection: { type: 'string', description: 'collection id, or "unsorted"' },
        url: { type: 'string', description: 'exact url match' },
        host: { type: 'string', description: 'exact host without www.' },
        status: { type: 'string', enum: STATUSES },
        limit: { type: 'number' },
      },
    },
    run: async (args) => {
      const status = STATUSES.includes(args.status as BookmarkStatus)
        ? (args.status as BookmarkStatus)
        : 'active'
      const filters: BookmarkFilters = {
        status,
        q: optionalText(args.q),
        tag: optionalText(args.tag),
        collection: optionalText(args.collection),
        url: optionalText(args.url),
        host: optionalText(args.host),
      }
      const limit = typeof args.limit === 'number' ? Math.min(args.limit, 100) : 25
      const rows = await queryBookmarks(filters)
      return rows.slice(0, Math.max(1, limit))
    },
  },
  {
    name: 'get_bookmark',
    description: 'Fetch one bookmark by id, including tags and metadata status.',
    scope: 'read',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    run: async (args) => {
      const bookmark = await getBookmarkById(text(args.id))
      if (!bookmark) throw new Error('Bookmark not found')
      return { ...bookmark, highlights: await listHighlights(bookmark.id) }
    },
  },
  {
    name: 'list_collections',
    description: 'List collections with their active bookmark counts.',
    scope: 'read',
    inputSchema: { type: 'object', properties: {} },
    run: () => queryCollections(),
  },
  {
    name: 'list_tags',
    description: 'List every tag in the library.',
    scope: 'read',
    inputSchema: { type: 'object', properties: {} },
    run: () => queryTags(),
  },
  {
    name: 'save_bookmark',
    description: 'Save a URL; metadata is fetched inline.',
    scope: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        collectionId: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['url'],
    },
    run: async (args) => {
      const url = text(args.url).trim()
      if (!url) throw new Error('url is required')
      const result = await createBookmarkRecord({
        url,
        tags: idList(args.tags),
        collectionId: optionalText(args.collectionId) ?? null,
        notes: optionalText(args.notes),
      })
      if (result.error) throw new Error(result.error)
      return { duplicate: result.duplicate, bookmark: result.bookmark }
    },
  },
  {
    name: 'update_bookmark',
    description: 'Update title, description, notes, tags, or collection of a bookmark.',
    scope: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        notes: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        collectionId: { type: 'string' },
      },
      required: ['id'],
    },
    run: async (args) => {
      const id = text(args.id)
      if (!id) throw new Error('id is required')
      const bookmark = await updateBookmarkRecord({
        id,
        ...(args.title !== undefined ? { title: text(args.title) } : {}),
        ...(args.description !== undefined
          ? { description: text(args.description) }
          : {}),
        ...(args.notes !== undefined ? { notes: text(args.notes) } : {}),
        ...(args.tags !== undefined ? { tags: idList(args.tags) } : {}),
        ...(args.collectionId !== undefined
          ? { collectionId: optionalText(args.collectionId) ?? null }
          : {}),
      })
      if (!bookmark) throw new Error('Bookmark not found')
      return bookmark
    },
  },
  {
    name: 'add_highlight',
    description: 'Save a highlighted quote (and optional note) onto a bookmark.',
    scope: 'write',
    inputSchema: {
      type: 'object',
      properties: {
        bookmarkId: { type: 'string' },
        quote: { type: 'string' },
        note: { type: 'string' },
      },
      required: ['bookmarkId', 'quote'],
    },
    run: async (args) => {
      const bookmarkId = text(args.bookmarkId)
      const quote = text(args.quote).trim()
      if (!bookmarkId || !quote) throw new Error('bookmarkId and quote are required')
      return createHighlight(bookmarkId, quote, optionalText(args.note) ?? null)
    },
  },
  {
    name: 'ask_bookmark',
    description:
      'Ask the configured model about one bookmark (summary, takeaways, plain, verdict).',
    scope: 'read',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        mode: { type: 'string', enum: ['summary', 'takeaways', 'plain', 'verdict'] },
      },
      required: ['id', 'mode'],
    },
    run: async (args) => {
      const id = text(args.id)
      const mode = text(args.mode) as AskMode
      if (!id || !ASK_MODES.includes(mode)) {
        throw new Error(`mode must be one of: ${ASK_MODES.join(', ')}`)
      }
      return askBookmark(id, mode)
    },
  },
  {
    name: 'set_status',
    description: 'Archive, restore (active), or trash a bookmark.',
    scope: 'write',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, status: { type: 'string', enum: STATUSES } },
      required: ['id', 'status'],
    },
    run: async (args) => {
      const status = args.status as BookmarkStatus
      if (!STATUSES.includes(status))
        throw new Error('status must be active, archived, or trashed')
      const bookmark = await setBookmarkStatus(text(args.id), status)
      if (!bookmark) throw new Error('Bookmark not found')
      return bookmark
    },
  },
]

function rpcResult(id: unknown, result: unknown) {
  return Response.json({ jsonrpc: '2.0', id, result })
}

function rpcError(id: unknown, code: number, message: string) {
  return Response.json({ jsonrpc: '2.0', id, error: { code, message } })
}

function toolList() {
  return TOOLS.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  }))
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('use POST for MCP messages', { status: 405 })
  }

  const denied = await authorizeApiRequest(request, 'read')
  if (denied) return denied

  let message: Record<string, unknown>
  try {
    const body = (await request.json()) as unknown
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return badRequest('expected a JSON-RPC message')
    }
    message = body as Record<string, unknown>
  } catch {
    return badRequest('invalid JSON body')
  }

  const id = message.id ?? null
  const method = typeof message.method === 'string' ? message.method : ''
  const params = (message.params ?? {}) as Record<string, unknown>

  if (method === 'initialize') {
    return rpcResult(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'pinshelf', version: '1.0.0' },
    })
  }

  // Notifications carry no id and expect no body back.
  if (method.startsWith('notifications/')) {
    return new Response(null, { status: 202 })
  }

  if (method === 'ping') return rpcResult(id, {})

  if (method === 'tools/list') return rpcResult(id, { tools: toolList() })

  if (method === 'tools/call') {
    const name = text(params.name)
    const tool = TOOLS.find((entry) => entry.name === name)
    if (!tool) return rpcError(id, -32602, `unknown tool: ${name}`)

    if (tool.scope === 'write') {
      const writeDenied = await authorizeApiRequest(request, 'write')
      if (writeDenied) return writeDenied
    }

    const args =
      typeof params.arguments === 'object' && params.arguments !== null
        ? (params.arguments as Record<string, unknown>)
        : {}

    try {
      const result = await tool.run(args)
      return rpcResult(id, {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        isError: false,
      })
    } catch (cause) {
      return rpcResult(id, {
        content: [
          {
            type: 'text',
            text: cause instanceof Error ? cause.message : 'tool failed',
          },
        ],
        isError: true,
      })
    }
  }

  if (method === 'resources/list') return rpcResult(id, { resources: [] })
  if (method === 'prompts/list') return rpcResult(id, { prompts: [] })

  return rpcError(id, -32601, `unsupported method: ${method}`)
}
