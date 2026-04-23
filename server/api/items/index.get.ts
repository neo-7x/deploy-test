import { desc } from 'drizzle-orm'
import { item } from '../../db/schemas'

export default defineEventHandler(async () => {
  const rows = await useDB().select().from(item).orderBy(desc(item.createdAt)).limit(50)
  return { data: rows }
})
