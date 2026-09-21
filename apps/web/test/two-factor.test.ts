import { eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { db } from '../src/db/index.server'
import { twoFactor, user } from '../src/db/schema'
import {
  discardPendingTwoFactor,
  pruneStaleTwoFactor,
} from '../src/lib/two-factor.server'

let userId = ''

beforeAll(async () => {
  userId = crypto.randomUUID()
  await db.insert(user).values({
    id: userId,
    name: 'Owner',
    email: 'owner@two-factor.test',
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
})

describe('two-factor enrollment hygiene', () => {
  it('discards the pending secret but leaves a verified one alone', async () => {
    await db.insert(twoFactor).values([
      { id: 'pending', secret: 's', backupCodes: '[]', userId, verified: false },
      { id: 'live', secret: 's', backupCodes: '[]', userId, verified: true },
    ])

    expect(await discardPendingTwoFactor(userId)).toBe(1)

    const rows = await db.select().from(twoFactor).where(eq(twoFactor.userId, userId))
    expect(rows.map((row) => row.id)).toEqual(['live'])
  })

  it('prunes only pending rows older than a day', async () => {
    const stale = new Date(Date.now() - 48 * 60 * 60 * 1000)
    await db.insert(twoFactor).values([
      {
        id: 'stale',
        secret: 's',
        backupCodes: '[]',
        userId,
        verified: false,
        createdAt: stale,
      },
      { id: 'fresh', secret: 's', backupCodes: '[]', userId, verified: false },
    ])

    expect(await pruneStaleTwoFactor()).toBe(1)

    const rows = await db.select().from(twoFactor).where(eq(twoFactor.userId, userId))
    expect(rows.map((row) => row.id).sort()).toEqual(['fresh', 'live'])
  })
})
