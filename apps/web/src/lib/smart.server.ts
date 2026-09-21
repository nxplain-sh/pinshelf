import { z } from 'zod'
import { callAi, parseStrictJson } from '~/lib/ai.server'
import type { BookmarkFilters, BookmarkSort } from '~/lib/bookmarks.types'
import type { TagMergeSuggestion } from '~/lib/ai-schemas'
import { listSavedSearches } from '~/lib/saved-searches.server'
import { queryCollections, queryTags } from '~/lib/taxonomy.server'

// Taxonomy goes into the prompt, so it is capped: a library with thousands of
// tags should cost the same to interpret as a small one.
const MAX_TAGS_IN_PROMPT = 100
const MAX_COLLECTIONS_IN_PROMPT = 50
const MAX_TEXT = 500

/**
 * A filter the model proposed, plus the sentence explaining what it understood.
 * Everything is validated against the real taxonomy before it can reach a
 * query, so a hallucinated tag or collection is dropped rather than run.
 */
export type SmartFilter = BookmarkFilters & { explanation: string | null }

export type SmartCollectionSuggestion = SmartFilter & { name: string; reason: string }

const SORTS: BookmarkSort[] = ['newest', 'oldest', 'title-asc', 'title-desc']
const STATUSES = ['active', 'archived', 'trashed'] as const

const filterShape = z.object({
  q: z.string().max(120).optional(),
  tag: z.string().max(64).optional(),
  collection: z.string().max(64).optional(),
  sort: z.enum(['newest', 'oldest', 'title-asc', 'title-desc']).optional(),
  status: z.enum(['active', 'archived', 'trashed']).optional(),
  explanation: z.string().max(200).optional(),
})

const suggestionShape = filterShape.extend({
  name: z.string().max(60),
  reason: z.string().max(200).default(''),
})

/** Collapses whitespace and drops control characters from model output. */
function cleanText(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined
  let printable = ''
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    printable += code < 32 || code === 127 ? ' ' : char
  }
  const cleaned = printable.replace(/\s+/g, ' ').trim()
  return cleaned ? cleaned.slice(0, max) : undefined
}

function matchKnown(value: string | undefined, known: string[]): string | undefined {
  if (!value) return undefined
  const wanted = value.trim().toLowerCase()
  return known.find((entry) => entry.toLowerCase() === wanted)
}

/** Drops anything the library cannot actually filter by. */
export function sanitizeSmartFilter(
  raw: unknown,
  taxonomy: { tags: string[]; collections: string[] },
): SmartFilter | null {
  const parsed = filterShape.safeParse(raw)
  if (!parsed.success) return null
  const value = parsed.data

  const q = cleanText(value.q, 120)
  const tag = matchKnown(cleanText(value.tag, 64), taxonomy.tags)
  const collection = matchKnown(cleanText(value.collection, 64), taxonomy.collections)
  const sort = value.sort && SORTS.includes(value.sort) ? value.sort : undefined
  const status = value.status && STATUSES.includes(value.status) ? value.status : 'active'

  if (!q && !tag && !collection) return null

  return {
    status,
    q,
    tag,
    collection,
    sort,
    explanation: cleanText(value.explanation, 200) ?? null,
  }
}

async function taxonomy() {
  const [tags, collections] = await Promise.all([queryTags(), queryCollections()])
  return {
    tags: tags.map((tag) => tag.name),
    collections: collections.map((collection) => collection.name),
    tagsTruncated: tags.length > MAX_TAGS_IN_PROMPT,
    collectionsTruncated: collections.length > MAX_COLLECTIONS_IN_PROMPT,
  }
}

/** What actually goes into the prompt: capped lists, no bookkeeping fields. */
function promptTaxonomy(known: Awaited<ReturnType<typeof taxonomy>>) {
  return {
    tags: known.tags.slice(0, MAX_TAGS_IN_PROMPT),
    collections: known.collections.slice(0, MAX_COLLECTIONS_IN_PROMPT),
  }
}

/** "rust posts from last month, newest first" → the filters that mean that. */
export async function interpretSearch(text: string): Promise<SmartFilter> {
  const known = await taxonomy()
  const content = await callAi([
    {
      role: 'system',
      content: [
        'You translate a bookmark search request into a filter object.',
        'Return STRICT JSON, no prose, no code fences:',
        '{"q":"...","tag":"...","collection":"...","sort":"newest|oldest|title-asc|title-desc","status":"active|archived|trashed","explanation":"one short sentence"}',
        'Rules:',
        '- Only use tags and collections from the provided lists; omit them when nothing fits.',
        '- q is full-text: use it for topics, hosts, or words the user named.',
        '- Omit fields that do not apply. Never invent a field.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify({
        intent: 'smart-search',
        request: text.slice(0, MAX_TEXT),
        ...promptTaxonomy(known),
      }),
    },
  ])

  const filter = sanitizeSmartFilter(parseStrictJson(content), known)
  if (!filter) throw new Error('Nothing in that request could be turned into a filter')
  return filter
}

/**
 * Proposes a handful of named filters over the existing taxonomy — smart
 * collections in the sense that they are saved searches, not a second kind of
 * folder (ADR-0009 keeps collections manual).
 */
export async function suggestSmartCollections(
  limit = 4,
): Promise<SmartCollectionSuggestion[]> {
  const known = await taxonomy()
  const content = await callAi([
    {
      role: 'system',
      content: [
        'You propose smart collections for a bookmark library.',
        'Return STRICT JSON, no prose, no code fences:',
        '{"collections":[{"name":"short lowercase name","q":"...","tag":"...","collection":"...","sort":"newest|oldest|title-asc|title-desc","reason":"one short sentence"}]}',
        'Rules:',
        '- Only use tags and collections from the provided lists; q may name a topic or host.',
        '- Each entry must have at least one of q, tag, or collection.',
        '- Prefer filters that will keep matching new saves; avoid one-off lists.',
        '- Propose at most the requested number, and fewer when the library is small.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify({
        intent: 'smart-collections',
        limit,
        ...promptTaxonomy(known),
      }),
    },
  ])

  const parsed = z
    .object({ collections: z.array(suggestionShape).max(10).default([]) })
    .safeParse(parseStrictJson(content))
  if (!parsed.success) throw new Error('The model did not return usable collections')

  // A suggestion that repeats an existing saved search, or another suggestion,
  // would create a duplicate the operator then has to clean up.
  const existingNames = new Set(
    (await listSavedSearches()).map((saved) => saved.name.toLowerCase()),
  )
  const seen = new Set<string>()

  return parsed.data.collections
    .map((entry) => {
      const filter = sanitizeSmartFilter(entry, known)
      const name = cleanText(entry.name, 60)
      if (!filter || !name) return null

      const key = name.toLowerCase()
      if (existingNames.has(key) || seen.has(key)) return null
      seen.add(key)

      return { ...filter, name, reason: cleanText(entry.reason, 200) ?? '' }
    })
    .filter((entry): entry is SmartCollectionSuggestion => entry !== null)
    .slice(0, limit)
}

const mergeShape = z.object({
  from: z.string().max(64),
  into: z.string().max(64),
  reason: z.string().max(200).default(''),
})

/**
 * Proposes merges for tags that mean the same thing (`recipe` / `recipes`).
 * Applying them is the operator's call in the toolbox; this only names pairs
 * from the real taxonomy, so nothing can be merged into a tag that is not
 * already there.
 */
export async function suggestTagMerges(): Promise<TagMergeSuggestion[]> {
  const tags = await queryTags()
  if (tags.length < 2) return []

  const known = tags.slice(0, MAX_TAGS_IN_PROMPT)
  const content = await callAi([
    {
      role: 'system',
      content: [
        'You tidy the tag list of a bookmark library.',
        'Return STRICT JSON, no prose, no code fences:',
        '{"merges":[{"from":"tag to drop","into":"tag to keep","reason":"one short sentence"}]}',
        'Rules:',
        '- Only pair tags that mean the same thing: plurals, typos, punctuation, synonyms.',
        '- Both names must come from the provided list; never invent a tag.',
        '- Keep the more common or clearer name as "into".',
        '- Each "from" may appear once; return at most 20 pairs, fewer when unsure.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify({ intent: 'tag-merges', tags: known.map((t) => t.name) }),
    },
  ])

  const parsed = z
    .object({ merges: z.array(mergeShape).max(50).default([]) })
    .safeParse(parseStrictJson(content))
  if (!parsed.success) throw new Error('The model did not return usable tag merges')

  const byName = new Map(known.map((tag) => [tag.name.toLowerCase(), tag]))
  const seen = new Set<string>()

  return parsed.data.merges
    .map((entry) => {
      const from = byName.get(entry.from.trim().toLowerCase())
      const into = byName.get(entry.into.trim().toLowerCase())
      if (!from || !into || from.id === into.id) return null
      if (seen.has(from.id)) return null
      seen.add(from.id)
      return {
        fromId: from.id,
        from: from.name,
        intoId: into.id,
        into: into.name,
        reason: cleanText(entry.reason, 200) ?? '',
      }
    })
    .filter((entry): entry is TagMergeSuggestion => entry !== null)
    .slice(0, 20)
}
