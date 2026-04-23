import { probeDatabaseState, setCachedState } from '../../utils/migration-state'
import { resolveConnectionString } from '../../utils/connection-string'

export default defineEventHandler(async () => {
  // Always probe live — never serve from cache. Status is the one endpoint
  // that must reflect reality after a manual DB fiddle or a concurrent run.
  const snapshot = await probeDatabaseState(resolveConnectionString())
  setCachedState(snapshot)
  return snapshot
})
