import { createServerFn } from '@tanstack/react-start'
import {
  createBackup,
  deleteBackup,
  getBackupRetention,
  listBackups,
  restoreBackup,
  setBackupRetention,
} from '~/lib/backup.server'
import { requireSession } from '~/lib/require-session'
import { requireString } from '~/lib/validate'

export const getBackups = createServerFn({ method: 'GET' })
  .middleware([requireSession])
  .handler(async () => {
    return {
      backups: await listBackups(),
      retention: await getBackupRetention(),
    }
  })

export const updateBackupRetention = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => {
    const days = (input as { days?: unknown } | null)?.days
    if (typeof days !== 'number') throw new Error('Expected "days" to be a number')
    return { days }
  })
  .handler(async ({ data }) => ({ retention: await setBackupRetention(data.days) }))

export const backupNow = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .handler(async () => createBackup('manual'))

export const restoreFromBackup = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => ({ key: requireString(input, 'key') }))
  .handler(async ({ data }) => restoreBackup(data.key))

export const removeBackup = createServerFn({ method: 'POST' })
  .middleware([requireSession])
  .validator((input: unknown) => ({ key: requireString(input, 'key') }))
  .handler(async ({ data }) => {
    await deleteBackup(data.key)
    return { key: data.key }
  })
