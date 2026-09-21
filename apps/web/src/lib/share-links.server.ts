import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '~/db/index.server'
import { shareLinks } from '~/db/schema'

const MAX_LINKS_PER_BOOKMARK = 5

export type ShareLink = {
  id: string
  token: string
  expiresAt: Date | null
  createdAt: Date
}

export async function listShareLinks(bookmarkId: string): Promise<ShareLink[]> {
  const rows = await db
    .select()
    .from(shareLinks)
    .where(and(eq(shareLinks.bookmarkId, bookmarkId), isNull(shareLinks.revokedAt)))
    .orderBy(desc(shareLinks.createdAt))
    .limit(MAX_LINKS_PER_BOOKMARK)

  return rows.map((row) => ({
    id: row.id,
    token: row.token,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  }))
}

export async function createShareLink(
  bookmarkId: string,
  expiresInDays: number | null,
): Promise<ShareLink> {
  const existing = await listShareLinks(bookmarkId)
  if (existing.length >= MAX_LINKS_PER_BOOKMARK) {
    throw new Error('This bookmark already has five links — revoke one first')
  }

  const bytes = crypto.getRandomValues(new Uint8Array(24))
  const token = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')

  const [created] = await db
    .insert(shareLinks)
    .values({
      id: crypto.randomUUID(),
      token,
      bookmarkId,
      expiresAt: expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : null,
      createdAt: new Date(),
    })
    .returning()

  return {
    id: created.id,
    token: created.token,
    expiresAt: created.expiresAt,
    createdAt: created.createdAt,
  }
}

export async function revokeShareLink(id: string): Promise<void> {
  await db.update(shareLinks).set({ revokedAt: new Date() }).where(eq(shareLinks.id, id))
}

/** Resolves a token to its bookmark id, or null when revoked or expired. */
export async function resolveShareToken(token: string): Promise<string | null> {
  const [row] = await db
    .select({ bookmarkId: shareLinks.bookmarkId, expiresAt: shareLinks.expiresAt })
    .from(shareLinks)
    .where(and(eq(shareLinks.token, token), isNull(shareLinks.revokedAt)))
    .limit(1)
  if (!row) return null
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null
  return row.bookmarkId
}
