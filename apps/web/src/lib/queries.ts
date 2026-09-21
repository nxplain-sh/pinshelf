import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  applyCleanup,
  clearAiKey,
  saveAiSettingsFn,
  smartSearch,
  suggestSmartCollections,
  testAiConnection,
} from '~/lib/ai'
import {
  backupNow,
  removeBackup,
  restoreFromBackup,
  updateBackupRetention,
} from '~/lib/backup'
import type { AiProposals } from '~/lib/ai-schemas'
import {
  archiveBookmark,
  bulkUpdate,
  createBookmark,
  reorderBookmarks,
  deleteBookmark,
  findDuplicates,
  refetchMetadata,
  restoreBookmark,
  trashBookmark,
  updateBookmark,
} from '~/lib/bookmarks'
import type {
  BookmarkFilters,
  BookmarkListItem,
  BulkUpdateInput,
  UpdateBookmarkInput,
} from '~/lib/bookmarks.types'
import { importBookmarks } from '~/lib/import-export'
import {
  addHighlight,
  archiveBookmark as archiveBookmarkPage,
  createShare,
  getHighlights,
  getSavedSearches,
  getShareLinks,
  removeHighlight,
  removeSavedSearch,
  revokeShare,
  saveSearch,
} from '~/lib/library'
import {
  createCollection,
  deleteCollection,
  mergeTag,
  renameCollection,
  renameTag,
} from '~/lib/taxonomy'
import { createApiToken, revokeApiToken } from '~/lib/tokens'

export const queryKeys = {
  bookmarks: {
    all: ['bookmarks'] as const,
    list: (filters: BookmarkFilters) => ['bookmarks', 'list', filters] as const,
    detail: (id: string) => ['bookmarks', 'detail', id] as const,
  },
  tags: ['tags'] as const,
  collections: ['collections'] as const,
  tokens: ['api-tokens'] as const,
  aiSettings: ['ai-settings'] as const,
  backups: ['backups'] as const,
  insights: ['insights'] as const,
  savedSearches: ['saved-searches'] as const,
  shareLinks: (id: string) => ['share-links', id] as const,
  highlights: (id: string) => ['highlights', id] as const,
}

export function useCreateBookmark() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (url: string) => createBookmark({ data: { url } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.tags })
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections })
    },
  })
}

export function useUpdateBookmark() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateBookmarkInput) => updateBookmark({ data: input }),
    onSuccess: (bookmark) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.tags })
      if (bookmark) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.bookmarks.detail(bookmark.id),
        })
      }
    },
  })
}

export function useTrashBookmark() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => trashBookmark({ data: { id } }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.bookmarks.all })
      const previous = queryClient.getQueriesData<BookmarkListItem[]>({
        queryKey: queryKeys.bookmarks.all,
      })
      queryClient.setQueriesData<BookmarkListItem[]>(
        { queryKey: queryKeys.bookmarks.all },
        (items) => items?.filter((item) => item.id !== id),
      )
      return { previous }
    },
    onError: (_error, _id, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.all })
    },
  })
}

export function useRestoreBookmark() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => restoreBookmark({ data: { id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.all })
    },
  })
}

export function useArchiveBookmark() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => archiveBookmark({ data: { id } }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.bookmarks.all })
      const previous = queryClient.getQueriesData<BookmarkListItem[]>({
        queryKey: queryKeys.bookmarks.all,
      })
      queryClient.setQueriesData<BookmarkListItem[]>(
        { queryKey: queryKeys.bookmarks.all },
        (items) => items?.filter((item) => item.id !== id),
      )
      return { previous }
    },
    onError: (_error, _id, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.all })
    },
  })
}

export function useFindDuplicates(enabled: boolean) {
  return useQuery({
    queryKey: [...queryKeys.bookmarks.all, 'duplicates'],
    queryFn: () => findDuplicates(),
    enabled,
  })
}

export function useRenameTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; name: string }) => renameTag({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tags })
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.all })
    },
  })
}

export function useMergeTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { fromId: string; intoId: string }) => mergeTag({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tags })
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.all })
    },
  })
}

export function useDeleteBookmark() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteBookmark({ data: { id } }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.bookmarks.all })
      const previous = queryClient.getQueriesData<BookmarkListItem[]>({
        queryKey: queryKeys.bookmarks.all,
      })
      queryClient.setQueriesData<BookmarkListItem[]>(
        { queryKey: queryKeys.bookmarks.all },
        (items) => items?.filter((item) => item.id !== id),
      )
      return { previous }
    },
    onError: (_error, _id, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.tags })
    },
  })
}

export function useRefetchMetadata() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => refetchMetadata({ data: { id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.all })
    },
  })
}

export function useReorderBookmarks() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => reorderBookmarks({ data: { ids } }),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.bookmarks.all })
      const previous = queryClient.getQueriesData<BookmarkListItem[]>({
        queryKey: queryKeys.bookmarks.all,
      })
      queryClient.setQueriesData<BookmarkListItem[]>(
        { queryKey: queryKeys.bookmarks.all },
        (items) => {
          if (!items) return items
          const byId = new Map(items.map((item) => [item.id, item]))
          const moved = ids
            .map((id) => byId.get(id))
            .filter((item): item is BookmarkListItem => item !== undefined)
          const rest = items.filter((item) => !ids.includes(item.id))
          return [...moved, ...rest]
        },
      )
      return { previous }
    },
    onError: (_error, _ids, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.all })
    },
  })
}

export function useBulkUpdate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: BulkUpdateInput) => bulkUpdate({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.tags })
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections })
    },
  })
}

export function useImportBookmarks() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { contents: string; filename: string }) =>
      importBookmarks({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.tags })
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections })
    },
  })
}

export function useCreateCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createCollection({ data: { name } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections })
    },
  })
}

export function useRenameCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; name: string }) =>
      renameCollection({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections })
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.all })
    },
  })
}

export function useDeleteCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCollection({ data: { id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections })
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.all })
    },
  })
}

export function useCreateApiToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      name: string
      expiresInDays: number | null
      readOnly: boolean
    }) => createApiToken({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tokens })
    },
  })
}

export function useRevokeApiToken() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (keyId: string) => revokeApiToken({ data: { keyId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tokens })
    },
  })
}

export function useSaveAiSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { baseUrl: string; model: string; apiKey?: string }) =>
      saveAiSettingsFn({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiSettings })
    },
  })
}

export function useClearAiKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => clearAiKey(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.aiSettings })
    },
  })
}

export function useTestAiConnection() {
  return useMutation({ mutationFn: () => testAiConnection() })
}

export function useApplyCleanup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (proposals: AiProposals) => applyCleanup({ data: { proposals } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.tags })
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections })
    },
  })
}

export function useBackupNow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => backupNow(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.backups })
    },
  })
}

export function useRestoreBackup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (key: string) => restoreFromBackup({ data: { key } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.tags })
      void queryClient.invalidateQueries({ queryKey: queryKeys.collections })
    },
  })
}

export function useRemoveBackup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (key: string) => removeBackup({ data: { key } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.backups })
    },
  })
}

export function useUpdateBackupRetention() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (days: number) => updateBackupRetention({ data: { days } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.backups })
    },
  })
}

export function useArchivePage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => archiveBookmarkPage({ data: { id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.insights })
    },
  })
}

export function useSavedSearches() {
  return useQuery({
    queryKey: queryKeys.savedSearches,
    queryFn: () => getSavedSearches(),
  })
}

export function useSmartSearch() {
  return useMutation({
    mutationFn: (text: string) => smartSearch({ data: { text } }),
  })
}

export function useSuggestSmartCollections() {
  return useMutation({
    mutationFn: (limit: number) => suggestSmartCollections({ data: { limit } }),
  })
}

export function useSaveSearch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; query: BookmarkFilters }) =>
      saveSearch({ data: input }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.savedSearches })
    },
  })
}

export function useRemoveSavedSearch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => removeSavedSearch({ data: { id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.savedSearches })
    },
  })
}

export function useShareLinks(id: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.shareLinks(id),
    queryFn: () => getShareLinks({ data: { id } }),
    enabled,
  })
}

export function useCreateShare() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; expiresInDays: number | null }) =>
      createShare({ data: input }),
    onSuccess: (link) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shareLinks(link.token) })
    },
  })
}

export function useRevokeShare(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (linkId: string) => revokeShare({ data: { id: linkId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shareLinks(id) })
    },
  })
}

export function useHighlights(id: string) {
  return useQuery({
    queryKey: queryKeys.highlights(id),
    queryFn: () => getHighlights({ data: { id } }),
  })
}

export function useAddHighlight(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { quote: string; note: string | null }) =>
      addHighlight({ data: { id, ...input } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.highlights(id) })
    },
  })
}

export function useRemoveHighlight(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (highlightId: string) => removeHighlight({ data: { id: highlightId } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.highlights(id) })
    },
  })
}
