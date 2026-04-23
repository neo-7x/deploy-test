import { desc, eq } from 'drizzle-orm'
import { item, user } from '../../db/schemas'

export default defineEventHandler(async () => {
  const rows = await useDB()
    .select({
      id: item.id,
      title: item.title,
      description: item.description,
      authorId: item.authorId,
      authorName: user.name,
      createdAt: item.createdAt,
    })
    .from(item)
    .leftJoin(user, eq(item.authorId, user.id))
    .orderBy(desc(item.createdAt))
    .limit(50)
  return { data: rows }
})
