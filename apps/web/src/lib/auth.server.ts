import { apiKey } from '@better-auth/api-key'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import { twoFactor } from 'better-auth/plugins'
import { env } from 'cloudflare:workers'
import { db } from '~/db/index.server'
import * as schema from '~/db/schema'

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      apikey: schema.apikey,
      twoFactor: schema.twoFactor,
      rateLimit: schema.rateLimit,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  // Vite picks the first free port and the container publishes its own, so in
  // dev the browser origin rarely matches BETTER_AUTH_URL and every auth POST
  // fails the origin check. Trust any localhost origin in dev only; production
  // trusts BETTER_AUTH_URL alone.
  trustedOrigins: import.meta.env.DEV
    ? (request) => {
        const origin = request?.headers.get('origin') ?? ''
        return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? [origin] : []
      }
    : [],
  // Stored in D1 rather than memory, so a limit survives isolate recycling.
  // Sign-in and the second factor get tight limits; everything else is loose
  // because this is a single-user instance talking to itself.
  rateLimit: {
    enabled: true,
    storage: 'database',
    window: 60,
    max: 120,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/two-factor/verify-totp': { window: 60, max: 5 },
      '/two-factor/verify-backup-code': { window: 60, max: 5 },
    },
  },
  plugins: [
    // The plugin default is 10 requests per day, which would break the
    // extension after ten saves. 300/minute is generous for one person.
    apiKey({
      rateLimit: {
        enabled: true,
        timeWindow: 60_000,
        maxRequests: 300,
      },
    }),
    twoFactor({ issuer: 'pinshelf' }),
  ],
  databaseHooks: {
    user: {
      create: {
        // pinshelf is single-user: first account wins, later signups are rejected.
        // The unique expression index in migration 0001 backs this at the DB level.
        before: async () => {
          const existing = await db
            .select({ id: schema.user.id })
            .from(schema.user)
            .limit(1)
          return existing.length > 0 ? false : undefined
        },
      },
    },
  },
})
