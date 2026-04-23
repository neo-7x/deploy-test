import { consola } from 'consola'
import { resolve } from 'path'
import { sql } from 'drizzle-orm'

// Startup routine for node-server (Docker): apply pending Drizzle migrations
// under pg_advisory_lock(42) so two containers / restarts never race.
//
// Gated to `node-server` preset:
//   - Vercel migrates via `vercel.json` buildCommand (fail-loud at deploy-time)
//   - Cloudflare Workers migrates out-of-band before `wrangler deploy`
//
// First admin provisioning is NOT handled here. `SYSTEM_ADMIN_EMAILS` +
// better-auth's `databaseHooks.user.create.before` promote the first sign-up
// whose email matches the whitelist, so there is no seed user and no default
// credential to leak.

const logger = consola.withTag('migrate')

export default defineNitroPlugin(async () => {
  if (import.meta.preset !== 'node-server') return

  const { db } = await import('../db')
  const { migrate } = await import('drizzle-orm/postgres-js/migrator')

  logger.info('Starting database migration...')
  const migrationsFolder = resolve(process.env.MIGRATIONS_DIR || 'server/db/migrations')
  logger.info(`Migrations folder: ${migrationsFolder}`)

  await db.execute(sql`SELECT pg_advisory_lock(42)`)
  try {
    await migrate(db, { migrationsFolder })
    logger.success('Database migration completed')
  } catch (error) {
    logger.error('Database migration failed:', error)
    throw error
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(42)`)
  }
})
