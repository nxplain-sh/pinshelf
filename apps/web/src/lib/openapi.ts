import { z } from 'zod'
import {
  createBookmarkSchema,
  listBookmarksQuerySchema,
  updateBookmarkSchema,
} from '~/lib/api-schemas'

const bookmarkSchema = {
  type: 'object',
  required: [
    'id',
    'url',
    'urlHash',
    'status',
    'metadataStatus',
    'metadataAttempts',
    'createdAt',
    'updatedAt',
  ],
  properties: {
    id: { type: 'string', description: 'Bookmark id' },
    url: { type: 'string', description: 'Normalized URL, tracking parameters removed' },
    urlHash: {
      type: 'string',
      description: 'SHA-256 of the normalized URL, used for dedupe',
    },
    title: { type: ['string', 'null'] },
    description: { type: ['string', 'null'] },
    notes: { type: ['string', 'null'] },
    siteName: { type: ['string', 'null'] },
    faviconUrl: { type: ['string', 'null'] },
    ogImageUrl: { type: ['string', 'null'] },
    collectionId: { type: ['string', 'null'] },
    collectionName: { type: ['string', 'null'] },
    tags: { type: 'array', items: { type: 'string' } },
    status: { type: 'string', enum: ['active', 'archived', 'trashed'] },
    metadataStatus: { type: 'string', enum: ['pending', 'done', 'failed'] },
    metadataAttempts: { type: 'integer' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const

function jsonResponse(description: string, schema: unknown) {
  return { description, content: { 'application/json': { schema } } }
}

const unauthorized = jsonResponse('Missing or invalid bearer token', {
  type: 'object',
  required: ['error'],
  properties: { error: { type: 'string' } },
})

const forbidden = jsonResponse(
  'The token is read-only; this route needs the write scope',
  {
    type: 'object',
    required: ['error'],
    properties: { error: { type: 'string' } },
  },
)

const badRequest = jsonResponse('Validation failed', {
  type: 'object',
  required: ['error'],
  properties: { error: { type: 'string', description: 'Human readable reason' } },
})

const notFound = jsonResponse('Unknown bookmark id', {
  type: 'object',
  required: ['error'],
  properties: { error: { type: 'string' } },
})

/**
 * OpenAPI document for the REST API. Request schemas are derived from the same
 * Zod schemas the handlers validate with, so the documentation cannot drift
 * from what the API accepts. Response schemas are written out by hand.
 */
export function buildOpenApiDocument(origin: string) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'pinshelf API',
      version: '1.0.0',
      description:
        'REST API for pinshelf. Every route requires an API token created on the settings page, sent as `Authorization: Bearer <token>`. Tokens are rate limited to 300 requests per minute.',
    },
    servers: [{ url: origin }],
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'bookmarks', description: 'Save, read, update, and delete bookmarks' },
      { name: 'taxonomy', description: 'Tags and collections for pickers' },
      { name: 'meta', description: 'Liveness and diagnostics' },
    ],
    paths: {
      '/api/bookmarks': {
        get: {
          tags: ['bookmarks'],
          summary: 'List bookmarks',
          parameters: [
            {
              name: 'status',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['active', 'archived', 'trashed'],
                default: 'active',
              },
            },
            {
              name: 'q',
              in: 'query',
              description:
                'Full-text search across title, description, notes, URL, and tags',
              schema: { type: 'string' },
            },
            { name: 'tag', in: 'query', schema: { type: 'string' } },
            {
              name: 'collection',
              in: 'query',
              description:
                'Collection id, or `unsorted` for bookmarks without a collection',
              schema: { type: 'string' },
            },
            {
              name: 'sort',
              in: 'query',
              description:
                'Ignored when `q` is present, because search results are ranked by relevance. `manual` uses the order set by dragging rows on the bookmarks page.',
              schema: {
                type: 'string',
                enum: ['newest', 'oldest', 'title-asc', 'title-desc', 'manual'],
                default: 'newest',
              },
            },
          ],
          responses: {
            200: jsonResponse('Matching bookmarks, newest first', {
              type: 'object',
              required: ['bookmarks'],
              properties: { bookmarks: { type: 'array', items: bookmarkSchema } },
            }),
            400: badRequest,
            401: unauthorized,
          },
        },
        post: {
          tags: ['bookmarks'],
          summary: 'Save a bookmark',
          description:
            'Normalizes the URL, deduplicates by URL hash, and fetches page metadata inline. Saving a trashed URL restores it.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: z.toJSONSchema(createBookmarkSchema, { io: 'input' }),
              },
            },
          },
          responses: {
            201: jsonResponse('Bookmark created', {
              type: 'object',
              required: ['bookmark', 'duplicate'],
              properties: { bookmark: bookmarkSchema, duplicate: { type: 'boolean' } },
            }),
            200: jsonResponse(
              'URL was already saved; the existing bookmark is returned',
              {
                type: 'object',
                required: ['bookmark', 'duplicate'],
                properties: { bookmark: bookmarkSchema, duplicate: { type: 'boolean' } },
              },
            ),
            400: badRequest,
            401: unauthorized,
            403: forbidden,
          },
        },
      },
      '/api/bookmarks/{id}': {
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        get: {
          tags: ['bookmarks'],
          summary: 'Get one bookmark',
          responses: {
            200: jsonResponse('The bookmark', {
              type: 'object',
              required: ['bookmark'],
              properties: { bookmark: bookmarkSchema },
            }),
            401: unauthorized,
            404: notFound,
          },
        },
        patch: {
          tags: ['bookmarks'],
          summary: 'Update a bookmark',
          description:
            'At least one field is required. `tags` replaces the full tag list.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: z.toJSONSchema(updateBookmarkSchema, { io: 'input' }),
              },
            },
          },
          responses: {
            200: jsonResponse('The updated bookmark', {
              type: 'object',
              required: ['bookmark'],
              properties: { bookmark: bookmarkSchema },
            }),
            400: badRequest,
            401: unauthorized,
            403: forbidden,
            404: notFound,
          },
        },
        delete: {
          tags: ['bookmarks'],
          summary: 'Delete a bookmark permanently',
          responses: {
            200: jsonResponse('Deleted', {
              type: 'object',
              required: ['deleted'],
              properties: { deleted: { type: 'string' } },
            }),
            401: unauthorized,
            403: forbidden,
            404: notFound,
          },
        },
      },
      '/api/collections': {
        get: {
          tags: ['taxonomy'],
          summary: 'List collections with active bookmark counts',
          responses: {
            200: jsonResponse('Collections', {
              type: 'object',
              required: ['collections'],
              properties: {
                collections: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['id', 'name', 'bookmarkCount'],
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      bookmarkCount: { type: 'integer' },
                    },
                  },
                },
              },
            }),
            401: unauthorized,
          },
        },
      },
      '/api/tags': {
        get: {
          tags: ['taxonomy'],
          summary: 'List tags',
          responses: {
            200: jsonResponse('Tags', {
              type: 'object',
              required: ['tags'],
              properties: {
                tags: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['id', 'name'],
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                    },
                  },
                },
              },
            }),
            401: unauthorized,
          },
        },
      },
      '/api/health': {
        get: {
          tags: ['meta'],
          summary: 'Liveness probe',
          description:
            'The only unauthenticated route. Touches the database, so a broken binding fails the check.',
          security: [],
          responses: {
            200: jsonResponse('Healthy', {
              type: 'object',
              required: ['ok'],
              properties: { ok: { type: 'boolean', enum: [true] } },
            }),
            503: jsonResponse('Database unreachable', {
              type: 'object',
              required: ['ok'],
              properties: { ok: { type: 'boolean', enum: [false] } },
            }),
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description:
            'API token from the settings page. Shown once at creation; revoke it there at any time.',
        },
      },
      schemas: {
        Bookmark: bookmarkSchema,
        ListQuery: z.toJSONSchema(listBookmarksQuerySchema, { io: 'input' }),
      },
    },
  }
}
