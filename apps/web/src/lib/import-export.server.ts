import {
  normalizeUrl,
  parseImportFile,
  tagNameKey,
  toMarkdown,
  toNetscapeHtml,
  urlHash,
} from '@pinshelf/shared'
import { asc, inArray } from 'drizzle-orm'
import { db } from '~/db/index.server'
import { bookmarkTags, bookmarks, collections, tags } from '~/db/schema'
import { ID_CHUNK, ROW_CHUNK, chunk } from '~/lib/db-utils'
import { reindexBookmarks, tagsByBookmarkId } from '~/lib/bookmarks.server'

const MAX_IMPORT_BYTES = 10 * 1024 * 1024
const MAX_IMPORT_ENTRIES = 5000
const BOOKMARK_COLUMNS_PER_ROW = 8

export type ImportSummary = {
  imported: number
  duplicates: number
  invalid: number
  collectionsCreated: number
  tagsCreated: number
}

export async function importBookmarks(
  contents: string,
  filename: string,
): Promise<ImportSummary> {
  if (contents.length > MAX_IMPORT_BYTES) {
    throw new Error('Import file is larger than 10 MB')
  }

  const parsed = parseImportFile(contents, filename).slice(0, MAX_IMPORT_ENTRIES)
  const summary: ImportSummary = {
    imported: 0,
    duplicates: 0,
    invalid: 0,
    collectionsCreated: 0,
    tagsCreated: 0,
  }

  const candidates: {
    url: string
    hash: string
    title: string | null
    description: string | null
    notes: string | null
    tags: string[]
    collection: string | null
    createdAt: Date | null
    status: 'active' | 'trashed'
  }[] = []

  for (const entry of parsed) {
    let normalized: string
    try {
      normalized = normalizeUrl(entry.url)
    } catch {
      summary.invalid++
      continue
    }
    candidates.push({
      url: normalized,
      hash: await urlHash(normalized),
      title: entry.title,
      description: entry.description,
      notes: entry.notes,
      tags: entry.tags,
      collection: entry.collection,
      createdAt: entry.createdAt,
      status: entry.status ?? 'active',
    })
  }

  const existingHashes = new Set<string>()
  for (const batch of chunk(
    candidates.map((candidate) => candidate.hash),
    ID_CHUNK,
  )) {
    const rows = await db
      .select({ urlHash: bookmarks.urlHash })
      .from(bookmarks)
      .where(inArray(bookmarks.urlHash, batch))
    for (const row of rows) existingHashes.add(row.urlHash)
  }

  const fresh = candidates.filter((candidate) => {
    if (existingHashes.has(candidate.hash)) {
      summary.duplicates++
      return false
    }
    existingHashes.add(candidate.hash)
    return true
  })

  const collectionIds = await ensureCollections(
    fresh
      .map((entry) => entry.collection)
      .filter((name): name is string => Boolean(name)),
    summary,
  )

  const now = new Date()
  const insertedIds: string[] = []
  const rows = fresh.map((entry) => {
    const id = crypto.randomUUID()
    insertedIds.push(id)
    return {
      id,
      url: entry.url,
      urlHash: entry.hash,
      title: entry.title,
      description: entry.description,
      notes: entry.notes,
      collectionId: entry.collection
        ? (collectionIds.get(tagNameKey(entry.collection)) ?? null)
        : null,
      status: entry.status,
      metadataStatus: 'done' as const,
      createdAt: entry.createdAt ?? now,
      updatedAt: now,
    }
  })

  for (const batch of chunk(rows, Math.floor(100 / BOOKMARK_COLUMNS_PER_ROW))) {
    await db.insert(bookmarks).values(batch).onConflictDoNothing()
  }
  summary.imported = insertedIds.length

  const tagIds = await ensureTags(
    fresh.flatMap((entry) => entry.tags),
    summary,
  )
  const links = fresh.flatMap((entry, index) =>
    entry.tags
      .map((tag) => tagIds.get(tagNameKey(tag)))
      .filter((tagId): tagId is string => Boolean(tagId))
      .map((tagId) => ({ bookmarkId: insertedIds[index], tagId })),
  )
  for (const batch of chunk(links, ROW_CHUNK)) {
    await db.insert(bookmarkTags).values(batch).onConflictDoNothing()
  }

  await reindexBookmarks(insertedIds)
  return summary
}

async function ensureCollections(
  names: string[],
  summary: ImportSummary,
): Promise<Map<string, string>> {
  const byKey = new Map<string, string>()
  for (const name of names) {
    const key = tagNameKey(name)
    if (!byKey.has(key)) byKey.set(key, name)
  }
  if (byKey.size === 0) return new Map()

  const existing = await db
    .select({ id: collections.id, nameKey: collections.nameKey })
    .from(collections)
    .where(inArray(collections.nameKey, [...byKey.keys()]))
  const ids = new Map(existing.map((row) => [row.nameKey, row.id]))

  const now = new Date()
  const missing = [...byKey].filter(([key]) => !ids.has(key))
  for (const [key, name] of missing) {
    const [created] = await db
      .insert(collections)
      .values({
        id: crypto.randomUUID(),
        name,
        nameKey: key,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing()
      .returning()
    if (created) {
      ids.set(key, created.id)
      summary.collectionsCreated++
    }
  }

  return ids
}

async function ensureTags(
  names: string[],
  summary: ImportSummary,
): Promise<Map<string, string>> {
  const byKey = new Map<string, string>()
  for (const raw of names) {
    const name = raw.trim().replace(/^#+/, '').replace(/\s+/g, ' ')
    if (!name || name.length > 64) continue
    const key = tagNameKey(name)
    if (!byKey.has(key)) byKey.set(key, name)
  }
  if (byKey.size === 0) return new Map()

  const existing = await db
    .select({ id: tags.id, nameKey: tags.nameKey })
    .from(tags)
    .where(inArray(tags.nameKey, [...byKey.keys()]))
  const ids = new Map(existing.map((row) => [row.nameKey, row.id]))

  const now = new Date()
  const missing = [...byKey].filter(([key]) => !ids.has(key))
  for (const [key, name] of missing) {
    const [created] = await db
      .insert(tags)
      .values({ id: crypto.randomUUID(), name, nameKey: key, createdAt: now })
      .onConflictDoNothing()
      .returning()
    if (created) {
      ids.set(key, created.id)
      summary.tagsCreated++
    }
  }

  return ids
}

type ExportRow = {
  url: string
  title: string | null
  description: string | null
  notes: string | null
  tags: string[]
  collection: string | null
  status: 'active' | 'archived' | 'trashed'
  createdAt: Date
}

async function exportRows(): Promise<ExportRow[]> {
  const rows = await db.select().from(bookmarks).orderBy(asc(bookmarks.createdAt))
  const tagMap = await tagsByBookmarkId(rows.map((row) => row.id))

  const collectionIds = [
    ...new Set(
      rows.map((row) => row.collectionId).filter((id): id is string => Boolean(id)),
    ),
  ]
  const collectionNames = new Map<string, string>()
  for (const batch of chunk(collectionIds, ID_CHUNK)) {
    const found = await db
      .select({ id: collections.id, name: collections.name })
      .from(collections)
      .where(inArray(collections.id, batch))
    for (const row of found) collectionNames.set(row.id, row.name)
  }

  return rows.map((row) => ({
    url: row.url,
    title: row.title,
    description: row.description,
    notes: row.notes,
    tags: tagMap.get(row.id) ?? [],
    collection: row.collectionId ? (collectionNames.get(row.collectionId) ?? null) : null,
    status: row.status,
    createdAt: row.createdAt,
  }))
}

export async function exportBookmarksJson(): Promise<string> {
  const rows = await exportRows()
  const collectionsUsed = [...new Set(rows.map((row) => row.collection).filter(Boolean))]

  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      collections: collectionsUsed,
      bookmarks: rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
    },
    null,
    2,
  )
}

export async function exportBookmarksNetscape(): Promise<string> {
  const rows = await exportRows()
  return toNetscapeHtml(rows.map((row) => ({ ...row, createdAt: row.createdAt })))
}

export async function exportBookmarksMarkdown(): Promise<string> {
  const rows = await exportRows()
  return toMarkdown(rows)
}
