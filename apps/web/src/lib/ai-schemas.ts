import { z } from 'zod'

export const aiProposalSchema = z.object({
  duplicates: z
    .array(
      z.object({
        keepId: z.string(),
        removeIds: z.array(z.string()),
        reason: z.string().max(300).optional(),
      }),
    )
    .default([]),
  updates: z
    .array(
      z.object({
        id: z.string(),
        tags: z.array(z.string()).max(8).optional(),
        description: z.string().max(400).optional(),
        collection: z.string().max(64).optional(),
      }),
    )
    .default([]),
})

export type AiProposals = z.infer<typeof aiProposalSchema>

export type CleanupCandidate = {
  id: string
  url: string
  title: string | null
  description: string | null
  tags: string[]
  collection: string | null
}

export type AiSettingsView = {
  baseUrl: string | null
  model: string | null
  hasApiKey: boolean
  apiKeyHint: string | null
}

export type ApplySummary = {
  trashed: number
  updated: number
  collectionsCreated: number
}
