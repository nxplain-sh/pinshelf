import { describe, expect, it } from 'vitest'
import { buildOpenApiDocument } from '../src/lib/openapi'

const document = buildOpenApiDocument('https://pinshelf.test')

describe('openapi document', () => {
  it('documents every REST route with bearer auth', () => {
    expect(Object.keys(document.paths).sort()).toEqual([
      '/api/bookmarks',
      '/api/bookmarks/{id}',
      '/api/collections',
      '/api/health',
      '/api/tags',
    ])
    expect(document.security).toEqual([{ bearerAuth: [] }])
    expect(document.components.securitySchemes.bearerAuth.scheme).toBe('bearer')
  })

  it('keeps health public and marks write routes as needing the write scope', () => {
    expect(document.paths['/api/health'].get.security).toEqual([])
    expect(document.paths['/api/health'].get.responses).toHaveProperty('503')
    expect(document.paths['/api/bookmarks'].post.responses).toHaveProperty('403')
    expect(document.paths['/api/bookmarks/{id}'].delete.responses).toHaveProperty('403')
  })

  it('lists the archived status wherever status is enumerated', () => {
    const bookmarkStatus = document.components.schemas.Bookmark.properties.status.enum
    expect(bookmarkStatus).toContain('archived')

    const queryStatus = document.paths['/api/bookmarks'].get.parameters[0].schema.enum
    expect(queryStatus).toContain('archived')
  })

  it('derives request schemas from the zod validators', () => {
    const create = document.paths['/api/bookmarks'].post.requestBody.content[
      'application/json'
    ].schema as { required?: string[]; properties?: Record<string, unknown> }

    expect(create.required).toContain('url')
    expect(Object.keys(create.properties ?? {})).toEqual(
      expect.arrayContaining(['url', 'tags', 'notes', 'collectionId']),
    )

    const patch = document.paths['/api/bookmarks/{id}'].patch.requestBody.content[
      'application/json'
    ].schema as { properties?: Record<string, unknown> }
    expect(Object.keys(patch.properties ?? {})).toEqual(
      expect.arrayContaining([
        'title',
        'description',
        'notes',
        'tags',
        'collectionId',
        'status',
      ]),
    )
  })

  it('uses the request origin as the server url', () => {
    expect(document.servers).toEqual([{ url: 'https://pinshelf.test' }])
  })
})
