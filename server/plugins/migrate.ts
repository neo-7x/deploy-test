import { consola } from 'consola'
import { resolve } from 'path'
import { eq, sql } from 'drizzle-orm'

// Startup routine for node-server (Docker) — runs once per container boot:
//   1. Apply pending Drizzle migrations under pg_advisory_lock(42)
//   2. If SEED_DEFAULT_ADMIN=true, seed the default admin under lock(43)
// Serialized with advisory locks so two containers / restarts never race.
//
// Gated to `node-server` preset:
//   - Vercel migrates via `vercel.json` buildCommand (fail-loud at deploy-time)
//   - Cloudflare Workers migrates out-of-band before `wrangler deploy`
//
// Single plugin (not two) on purpose: Nitro's plugin loader does not await
// async plugins sequentially, so splitting "migrate" and "seed-admin" into
// separate files races the seed against the migration's CREATE TABLE.

const migrateLogger = consola.withTag('migrate')
const seedLogger = consola.withTag('seed-admin')

const ADMIN_EMAIL = 'admin@deploy-test.local'
const ADMIN_USER_ID = 'seed-admin-default'
const ADMIN_ACCOUNT_ID = `${ADMIN_USER_ID}-cred`
const DEFAULT_PASSWORD = 'changedefaultpassword'

function parseBool(v: string | undefined): boolean {
  if (!v) return false
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())
}

export default defineNitroPlugin(async () => {
  if (import.meta.preset !== 'node-server') return

  const { db } = await import('../db')
  const { migrate } = await import('drizzle-orm/postgres-js/migrator')
  const { user, account } = await import('../db/schemas')

  // Step 1 — migrate
  migrateLogger.info('Starting database migration...')
  const migrationsFolder = resolve(process.env.MIGRATIONS_DIR || 'server/db/migrations')
  migrateLogger.info(`Migrations folder: ${migrationsFolder}`)

  await db.execute(sql`SELECT pg_advisory_lock(42)`)
  try {
    await migrate(db, { migrationsFolder })
    migrateLogger.success('Database migration completed')
  } catch (error) {
    migrateLogger.error('Database migration failed:', error)
    throw error
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(42)`)
  }

  // Step 2 — opt-in seed admin (only after migrations are confirmed applied)
  if (!parseBool(process.env.SEED_DEFAULT_ADMIN)) return

  const { hashPassword } = await import('better-auth/crypto')

  await db.execute(sql`SELECT pg_advisory_lock(43)`)
  try {
    const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, ADMIN_EMAIL)).limit(1)
    if (existing.length > 0) return

    const passwordHash = await hashPassword(DEFAULT_PASSWORD)
    await db.insert(user).values({
      id: ADMIN_USER_ID,
      name: 'Deploy Test Admin',
      email: ADMIN_EMAIL,
      emailVerified: true,
      role: 'admin',
    })
    await db.insert(account).values({
      id: ADMIN_ACCOUNT_ID,
      accountId: ADMIN_USER_ID,
      providerId: 'credential',
      userId: ADMIN_USER_ID,
      password: passwordHash,
    })

    seedLogger.warn(`Default admin created: ${ADMIN_EMAIL} / ${DEFAULT_PASSWORD}`)
    seedLogger.warn('CHANGE THIS PASSWORD before exposing the deploy publicly.')
  } catch (err) {
    seedLogger.error('Failed to seed default admin:', err)
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(43)`)
  }
})
