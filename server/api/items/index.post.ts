import { z } from 'zod'
import { item } from '../../db/schemas'

const bodySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
})

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event)
  const body = await readValidatedBody(event, bodySchema.parse)

  const [row] = await useDB().insert(item).values({
    authorId: user.id,
    title: body.title,
    description: body.description,
  }).returning()

  return row
})
