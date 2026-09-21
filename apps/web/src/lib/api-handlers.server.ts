import { sql } from 'drizzle-orm'
import {
  authorizeApiRequest,
  badRequest,
  badRequestFromZod,
  notFound,
  readJsonObject,
} from '~/lib/api.server'
import {
  createBookmarkSchema,
  listBookmarksQuerySchema,
  updateBookmarkSchema,
} from '~/lib/api-schemas'
import {
  createBookmarkRecord,
  deleteBookmarkRecord,
  getBookmarkById,
  queryBookmarks,
  setBookmarkStatus,
  updateBookmarkRecord,
} from '~/lib/bookmarks.server'
import { queryCollections, queryTags } from '~/lib/taxonomy.server'
import { db } from '~/db/index.server'

/**
 * Liveness probe for container healthchecks and uptime monitors. It touches the
 * database so a broken binding fails the check, and it exposes nothing else.
 */
export async function handleHealth(): Promise<Response> {
  try {
    await db.get(sql`select 1`)
    return Response.json({ ok: true })
  } catch {
    return Response.json({ ok: false }, { status: 503 })
  }
}

export async function handleListBookmarks(request: Request): Promise<Response> {
  const denied = await authorizeApiRequest(request)
  if (denied) return denied

  const params = Object.fromEntries(new URL(request.url).searchParams)
  const parsed = listBookmarksQuerySchema.safeParse(params)
  if (!parsed.success) return badRequestFromZod(parsed.error)

  return Response.json({ bookmarks: await queryBookmarks(parsed.data) })
}

export async function handleCreateBookmark(request: Request): Promise<Response> {
  const denied = await authorizeApiRequest(request, 'write')
  if (denied) return denied

  const body = await readJsonObject(request)
  if (body instanceof Response) return body

  const parsed = createBookmarkSchema.safeParse(body)
  if (!parsed.success) return badRequestFromZod(parsed.error)

  const result = await createBookmarkRecord(parsed.data)
  if (result.error) return badRequest(result.error)

  return Response.json(
    { bookmark: result.bookmark, duplicate: result.duplicate },
    { status: result.duplicate ? 200 : 201 },
  )
}

export async function handleGetBookmark(request: Request, id: string): Promise<Response> {
  const denied = await authorizeApiRequest(request)
  if (denied) return denied

  const bookmark = await getBookmarkById(id)
  if (!bookmark) return notFound('bookmark not found')
  return Response.json({ bookmark })
}

export async function handleUpdateBookmark(
  request: Request,
  id: string,
): Promise<Response> {
  const denied = await authorizeApiRequest(request, 'write')
  if (denied) return denied

  const body = await readJsonObject(request)
  if (body instanceof Response) return body

  const parsed = updateBookmarkSchema.safeParse(body)
  if (!parsed.success) return badRequestFromZod(parsed.error)

  const { status, ...fields } = parsed.data
  if (status !== undefined) {
    const updated = await setBookmarkStatus(id, status)
    if (!updated) return notFound('bookmark not found')
  }

  const updated = await updateBookmarkRecord({ id, ...fields })
  if (!updated) return notFound('bookmark not found')

  return Response.json({ bookmark: await getBookmarkById(id) })
}

export async function handleDeleteBookmark(
  request: Request,
  id: string,
): Promise<Response> {
  const denied = await authorizeApiRequest(request, 'write')
  if (denied) return denied

  const bookmark = await getBookmarkById(id)
  if (!bookmark) return notFound('bookmark not found')

  await deleteBookmarkRecord(id)
  return Response.json({ deleted: id })
}

export async function handleListCollections(request: Request): Promise<Response> {
  const denied = await authorizeApiRequest(request)
  if (denied) return denied

  return Response.json({ collections: await queryCollections() })
}

export async function handleListTags(request: Request): Promise<Response> {
  const denied = await authorizeApiRequest(request)
  if (denied) return denied

  return Response.json({ tags: await queryTags() })
}
