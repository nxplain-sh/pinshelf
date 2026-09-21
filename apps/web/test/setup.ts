import { env } from 'cloudflare:workers'
import { applyD1Migrations } from 'cloudflare:test'
import type { D1Migration } from '@cloudflare/vitest-plugin'

// TEST_MIGRATIONS is injected by vitest.config.ts and is not part of the app's
// wrangler bindings, so it is not in the generated Env type.
const migrations = (env as unknown as { TEST_MIGRATIONS: D1Migration[] }).TEST_MIGRATIONS

await applyD1Migrations(env.DB, migrations)
