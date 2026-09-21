import { and, eq, lt } from 'drizzle-orm'
import { db } from '~/db/index.server'
import { twoFactor } from '~/db/schema'

// How long a scanned-but-unverified enrollment stays valid. The UI expires the
// QR after minutes; this is the backstop for tabs that were simply closed.
const PENDING_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Removes the pending (unverified) TOTP enrollment for a user. An unverified
 * secret cannot sign anyone in — Better Auth only offers TOTP once `verified`
 * is true — so deleting it is safe and makes "expired" mean gone.
 */
export async function discardPendingTwoFactor(userId: string): Promise<number> {
  const removed = await db
    .delete(twoFactor)
    .where(and(eq(twoFactor.userId, userId), eq(twoFactor.verified, false)))
    .returning({ id: twoFactor.id })
  return removed.length
}

/** Cron hygiene: abandoned enrollments are deleted after a day. */
export async function pruneStaleTwoFactor(): Promise<number> {
  const cutoff = new Date(Date.now() - PENDING_TTL_MS)
  const removed = await db
    .delete(twoFactor)
    .where(and(eq(twoFactor.verified, false), lt(twoFactor.createdAt, cutoff)))
    .returning({ id: twoFactor.id })
  return removed.length
}
