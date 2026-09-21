import { createServerFn } from '@tanstack/react-start'
import {
  exportBookmarksJson,
  exportBookmarksMarkdown,
  exportBookmarksNetscape,
  importBookmarks as importBookmarksFile,
} from '~/lib/import-export.server'
import { requireString } from '~/lib/validate'
import { requireSession } from '~/lib/require-session'

export const importBookmarks = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => ({
    contents: requireString(input, 'contents'),
    filename:
      typeof (input as { filename?: unknown }).filename === 'string'
        ? (input as { filename: string }).filename
        : '',
  }))
  .handler(async ({ data }) => importBookmarksFile(data.contents, data.filename))

export const exportJson = createServerFn({ method: 'GET' })
  .middleware([requireSession])
  .handler(async () => {
    return { filename: 'pinshelf-backup.json', contents: await exportBookmarksJson() }
  })

export const exportNetscape = createServerFn({ method: 'GET' })
  .middleware([requireSession])
  .handler(async () => {
    return {
      filename: 'pinshelf-bookmarks.html',
      contents: await exportBookmarksNetscape(),
    }
  })

export const exportMarkdown = createServerFn({ method: 'GET' })
  .middleware([requireSession])
  .handler(async () => {
    return {
      filename: 'pinshelf-bookmarks.md',
      contents: await exportBookmarksMarkdown(),
    }
  })
