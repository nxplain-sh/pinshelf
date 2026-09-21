import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(),
  aiBaseUrl: text('ai_base_url'),
  aiApiKey: text('ai_api_key'),
  aiModel: text('ai_model'),
  backupRetention: integer('backup_retention').notNull().default(30),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export type Settings = typeof settings.$inferSelect

export const collections = sqliteTable('collections', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nameKey: text('name_key').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  nameKey: text('name_key').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  twoFactorEnabled: integer('two_factor_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const twoFactor = sqliteTable(
  'two_factor',
  {
    id: text('id').primaryKey(),
    secret: text('secret').notNull(),
    backupCodes: text('backup_codes').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    verified: integer('verified', { mode: 'boolean' }).default(true),
    failedVerificationCount: integer('failed_verification_count').default(0),
    lockedUntil: integer('locked_until', { mode: 'timestamp' }),
    // Filled by SQLite: the plugin does not send this column, and a pending
    // enrollment needs an age so stale ones can be pruned.
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [index('two_factor_user_idx').on(table.userId)],
)

// Better Auth's rate limiter, kept in the database so the limit survives
// isolate restarts instead of resetting with every cold start.
export const rateLimit = sqliteTable(
  'rate_limit',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull(),
    count: integer('count').notNull(),
    lastRequest: integer('last_request').notNull(),
  },
  (table) => [index('rate_limit_key_idx').on(table.key)],
)

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', {
    mode: 'timestamp',
  }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', {
    mode: 'timestamp',
  }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const bookmarks = sqliteTable(
  'bookmarks',
  {
    id: text('id').primaryKey(),
    url: text('url').notNull(),
    urlHash: text('url_hash').notNull().unique(),
    title: text('title'),
    description: text('description'),
    notes: text('notes'),
    siteName: text('site_name'),
    faviconUrl: text('favicon_url'),
    ogImageUrl: text('og_image_url'),
    collectionId: text('collection_id').references(() => collections.id, {
      onDelete: 'set null',
    }),
    status: text('status', { enum: ['active', 'archived', 'trashed'] })
      .notNull()
      .default('active'),
    metadataStatus: text('metadata_status', {
      enum: ['pending', 'done', 'failed'],
    })
      .notNull()
      .default('pending'),
    metadataAttempts: integer('metadata_attempts').notNull().default(0),
    linkStatus: text('link_status', { enum: ['unknown', 'ok', 'broken'] })
      .notNull()
      .default('unknown'),
    linkCheckedAt: integer('link_checked_at', { mode: 'timestamp' }),
    archiveKey: text('archive_key'),
    archiveStatus: text('archive_status', { enum: ['none', 'done', 'failed'] })
      .notNull()
      .default('none'),
    archivedAt: integer('archived_at', { mode: 'timestamp' }),
    sortIndex: integer('sort_index'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('bookmarks_status_created_idx').on(table.status, table.createdAt),
    index('bookmarks_collection_idx').on(table.collectionId),
    index('bookmarks_link_checked_idx').on(table.linkCheckedAt),
  ],
)

export type Bookmark = typeof bookmarks.$inferSelect
export type Collection = typeof collections.$inferSelect
export type Tag = typeof tags.$inferSelect
export type TwoFactor = typeof twoFactor.$inferSelect

export const bookmarkTags = sqliteTable(
  'bookmark_tags',
  {
    bookmarkId: text('bookmark_id')
      .notNull()
      .references(() => bookmarks.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.bookmarkId, table.tagId] }),
    index('bookmark_tags_tag_idx').on(table.tagId),
  ],
)

export const highlights = sqliteTable(
  'highlights',
  {
    id: text('id').primaryKey(),
    bookmarkId: text('bookmark_id')
      .notNull()
      .references(() => bookmarks.id, { onDelete: 'cascade' }),
    quote: text('quote').notNull(),
    note: text('note'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [index('highlights_bookmark_idx').on(table.bookmarkId)],
)

export const savedSearches = sqliteTable('saved_searches', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  // Serialized BookmarkFilters, so a saved search cannot drift from the list it
  // was saved on.
  query: text('query').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export const shareLinks = sqliteTable(
  'share_links',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull().unique(),
    bookmarkId: text('bookmark_id')
      .notNull()
      .references(() => bookmarks.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    revokedAt: integer('revoked_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [index('share_links_bookmark_idx').on(table.bookmarkId)],
)

export const apikey = sqliteTable(
  'apikey',
  {
    id: text('id').primaryKey(),
    configId: text('config_id').notNull().default('default'),
    name: text('name'),
    start: text('start'),
    prefix: text('prefix'),
    key: text('key').notNull(),
    referenceId: text('reference_id').notNull(),
    refillInterval: integer('refill_interval'),
    refillAmount: integer('refill_amount'),
    lastRefillAt: integer('last_refill_at', { mode: 'timestamp' }),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    rateLimitEnabled: integer('rate_limit_enabled', { mode: 'boolean' })
      .notNull()
      .default(true),
    rateLimitTimeWindow: integer('rate_limit_time_window'),
    rateLimitMax: integer('rate_limit_max'),
    requestCount: integer('request_count').notNull().default(0),
    remaining: integer('remaining'),
    lastRequest: integer('last_request', { mode: 'timestamp' }),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    permissions: text('permissions'),
    metadata: text('metadata'),
  },
  (table) => [
    index('apikey_config_id_idx').on(table.configId),
    index('apikey_reference_id_idx').on(table.referenceId),
    index('apikey_key_idx').on(table.key),
  ],
)
