import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schemas'

// Two connection paths, picked at runtime by Nitro preset:
//   - Cloudflare Workers: read the Hyperdrive binding and connect per request
//     (Workers can't hold long-lived TCP pools; Hyperdrive pools server-side)
//   - Node.js (Docker / Vercel): long-lived singleton driven by DATABASE_URL

type DB = ReturnType<typeof drizzle<typeof schema>>

let _db: DB | null = null

function getDb(): DB {
  const isCF = import.meta.preset === 'cloudflare-module' || import.meta.preset === 'cloudflare-pages'

  if (isCF) {
    // Nitro's cloudflare-module runtime exposes env bindings on globalThis.__env__,
    // with a fallback to direct properties for older runtimes.
    const g = globalThis as unknown as { __env__?: { POSTGRES?: { connectionString: string } }; POSTGRES?: { connectionString: string } }
    const binding = g.__env__?.POSTGRES || g.POSTGRES
    if (!binding) throw new Error('POSTGRES Hyperdrive binding not found — declare [[hyperdrive]] in wrangler.toml')
    return drizzle(postgres(binding.connectionString, { prepare: false }), { schema })
  }

  if (!_db) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
    _db = drizzle(postgres(process.env.DATABASE_URL, { max: 5, prepare: false }), { schema })
  }
  return _db
}

export const db = new Proxy({} as DB, {
  get(_, prop) {
    return getDb()[prop as keyof DB]
  },
})
