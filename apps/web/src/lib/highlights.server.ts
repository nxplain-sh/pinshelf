import { asc, eq } from 'drizzle-orm'
import { db } from '~/db/index.server'
import { highlights } from '~/db/schema'

export type Highlight = {
  id: string
  quote: string
  note: string | null
  createdAt: Date
}

const MAX_QUOTE = 2000
const MAX_NOTE = 2000

export async function listHighlights(bookmarkId: string): Promise<Highlight[]> {
  const rows = await db
    .select()
    .from(highlights)
    .where(eq(highlights.bookmarkId, bookmarkId))
    .orderBy(asc(highlights.createdAt))
  return rows.map((row) => ({
    id: row.id,
    quote: row.quote,
    note: row.note,
    createdAt: row.createdAt,
  }))
}

export async function createHighlight(
  bookmarkId: string,
  quote: string,
  note: string | null,
): Promise<Highlight> {
  const cleanQuote = quote.trim().slice(0, MAX_QUOTE)
  if (!cleanQuote) throw new Error('A highlight needs some text')

  const [created] = await db
    .insert(highlights)
    .values({
      id: crypto.randomUUID(),
      bookmarkId,
      quote: cleanQuote,
      note: note?.trim().slice(0, MAX_NOTE) || null,
      createdAt: new Date(),
    })
    .returning()

  return {
    id: created.id,
    quote: created.quote,
    note: created.note,
    createdAt: created.createdAt,
  }
}

export async function deleteHighlight(id: string): Promise<void> {
  await db.delete(highlights).where(eq(highlights.id, id))
}
