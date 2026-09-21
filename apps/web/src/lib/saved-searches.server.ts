import { desc, eq } from 'drizzle-orm'
import { db } from '~/db/index.server'
import { savedSearches } from '~/db/schema'
import type { BookmarkFilters } from '~/lib/bookmarks.types'

export type SavedSearch = {
  id: string
  name: string
  query: BookmarkFilters
  createdAt: Date
}

function parseQuery(raw: string): BookmarkFilters {
  try {
    const parsed = JSON.parse(raw) as BookmarkFilters
    return { ...parsed, status: parsed.status ?? 'active' }
  } catch {
    return { status: 'active' }
  }
}

export async function listSavedSearches(): Promise<SavedSearch[]> {
  const rows = await db
    .select()
    .from(savedSearches)
    .orderBy(desc(savedSearches.createdAt))
    .limit(50)
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    query: parseQuery(row.query),
    createdAt: row.createdAt,
  }))
}

export async function createSavedSearch(
  name: string,
  query: BookmarkFilters,
): Promise<SavedSearch> {
  const clean = name.trim().slice(0, 60)
  if (!clean) throw new Error('Give the search a name')

  const [created] = await db
    .insert(savedSearches)
    .values({
      id: crypto.randomUUID(),
      name: clean,
      query: JSON.stringify(query),
      createdAt: new Date(),
    })
    .returning()

  return {
    id: created.id,
    name: created.name,
    query: parseQuery(created.query),
    createdAt: created.createdAt,
  }
}

export async function deleteSavedSearch(id: string): Promise<void> {
  await db.delete(savedSearches).where(eq(savedSearches.id, id))
}
