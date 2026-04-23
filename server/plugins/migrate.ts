import { consola } from 'consola'
import { resolve } from 'path'
import { sql } from 'drizzle-orm'

// Startup routine for node-server (Docker): apply pending Drizzle migrations
// under pg_advisory_lock(42) so two containers / restarts never race.
//
// Preset policy:
//   - node-server: this plugin (blocks boot until migrations finish)
//   - vercel: out-of-band via vercel.json buildCommand
//   - cloudflare-*: via modules/cf-setup (runtime /setup page + endpoints —
//     Workers have no boot phase for async DB work)

const logger = consola.withTag('migrate')

export default defineNitroPlugin(async () => {
  if (import.meta.preset !== 'node-server') return

  const { db } = await import('../db')
  const { migrate } = await import('drizzle-orm/postgres-js/migrator')

  logger.info('Starting database migration...')
  const migrationsFolder = resolve(process.env.MIGRATIONS_DIR || 'server/db/migrations')
  logger.info(`Migrations folder: ${migrationsFolder}`)

  const start = Date.now()
  await db.execute(sql`SELECT pg_advisory_lock(42)`)
  try {
    await migrate(db, { migrationsFolder })
    logger.success(`Database migration completed in ${Date.now() - start}ms`)
  } catch (error) {
    logger.error(`Database migration failed after ${Date.now() - start}ms:`, error)
    throw error
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(42)`)
  }
})
