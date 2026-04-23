// Re-export the db instance so Nitro auto-imports `useDB()` everywhere.
import { db } from '../db'

export function useDB() {
  return db
}
