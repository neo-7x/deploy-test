// Spike endpoint: introspect the /bundle virtual FS on Cloudflare Workers.
// Verifies whether find_additional_modules actually lands SQL files under
// a predictable path at runtime. Not part of the product; remove after the
// runtime-migration design is settled.

import fs from 'node:fs'

export default defineEventHandler(() => {
  const preset = import.meta.preset

  if (preset !== 'cloudflare-module' && preset !== 'cloudflare-pages') {
    return { preset, note: '/bundle only exists on Cloudflare Workers' }
  }

  function walk(dir: string, depth = 0): unknown {
    if (depth > 6) return '<depth-limit>'
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      return entries.map((e) => {
        const full = `${dir}/${e.name}`
        if (e.isDirectory()) {
          return { name: e.name, type: 'dir', children: walk(full, depth + 1) }
        }
        let size = -1
        try { size = fs.statSync(full).size } catch {}
        return { name: e.name, type: 'file', size }
      })
    } catch (err) {
      return { error: String(err) }
    }
  }

  // Try a few probe paths to pin down where SQL files end up
  const probes = [
    '/bundle',
    '/bundle/db',
    '/bundle/db/migrations',
    '/bundle/server',
    '/bundle/server/db',
    '/bundle/server/db/migrations',
    '/bundle/.output',
    '/bundle/.output/server',
    '/bundle/.output/server/db',
    '/bundle/.output/server/db/migrations',
  ]
  const probeResults = probes.map((p) => {
    try {
      const stat = fs.statSync(p)
      return { path: p, exists: true, isDir: stat.isDirectory() }
    } catch (err) {
      return { path: p, exists: false, error: String(err).slice(0, 120) }
    }
  })

  // Read a migration file end-to-end to confirm content integrity
  let sampleRead: unknown
  try {
    const journal = fs.readFileSync('/bundle/db/migrations/meta/_journal.json', 'utf-8')
    const firstSql = fs.readFileSync('/bundle/db/migrations/0000_hot_susan_delgado.sql', 'utf-8')
    sampleRead = {
      journalLen: journal.length,
      journalParsed: JSON.parse(journal),
      firstSqlLen: firstSql.length,
      firstSqlHead: firstSql.slice(0, 200),
    }
  } catch (err) {
    sampleRead = { error: String(err) }
  }

  return {
    preset,
    cwd: process.cwd(),
    bundleTree: walk('/bundle'),
    probes: probeResults,
    sampleRead,
  }
})
