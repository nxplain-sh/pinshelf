import { z } from 'zod'

const tagList = z.array(z.string()).max(50)

export const listBookmarksQuerySchema = z.object({
  status: z.enum(['active', 'archived', 'trashed']).default('active'),
  q: z.string().trim().min(1).max(200).optional(),
  tag: z.string().trim().min(1).max(64).optional(),
  collection: z.string().trim().min(1).max(64).optional(),
  url: z.string().trim().min(1).max(2048).optional(),
  host: z.string().trim().min(1).max(255).optional(),
  sort: z.enum(['newest', 'oldest', 'title-asc', 'title-desc', 'manual']).optional(),
})

export const createBookmarkSchema = z.object({
  url: z.string().trim().min(1).max(2048),
  tags: tagList.optional(),
  notes: z.string().max(10_000).optional(),
  collectionId: z.string().max(64).nullable().optional(),
})

export const updateBookmarkSchema = z
  .object({
    title: z.string().max(500).optional(),
    description: z.string().max(2000).optional(),
    notes: z.string().max(10_000).optional(),
    tags: tagList.optional(),
    collectionId: z.string().max(64).nullable().optional(),
    status: z.enum(['active', 'archived', 'trashed']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'provide at least one field to update',
  })

export type CreateBookmarkBody = z.infer<typeof createBookmarkSchema>
export type UpdateBookmarkBody = z.infer<typeof updateBookmarkSchema>

export const createHighlightSchema = z.object({
  bookmarkId: z.string().min(1).max(64),
  quote: z.string().trim().min(1).max(20_000),
  note: z.string().max(10_000).optional(),
})

export const askBookmarkSchema = z.object({
  mode: z.enum(['summary', 'takeaways', 'plain', 'verdict']),
})

export type CreateHighlightBody = z.infer<typeof createHighlightSchema>
export type AskBookmarkBody = z.infer<typeof askBookmarkSchema>
