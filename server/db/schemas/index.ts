import { pgTable, uuid, text, varchar, timestamp, index } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { uuidv7 } from 'uuidv7'

export { user, session, account, verification, sessionRelations, accountRelations } from './auth'
import { user } from './auth'

// A single generic "item" table — just enough surface to prove the deploy
// pipeline handles: migrations, seeds, authenticated writes, and a public
// list endpoint. No business semantics.
export const item = pgTable(
  'item',
  {
    id: uuid().primaryKey().$defaultFn(() => uuidv7()),
    authorId: text('author_id').notNull(),
    title: varchar({ length: 200 }).notNull(),
    description: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index('idx_item_created').on(sql`${t.createdAt} DESC`, sql`${t.id} DESC`),
  ],
)

export const itemRelations = relations(item, ({ one }) => ({
  author: one(user, { fields: [item.authorId], references: [user.id] }),
}))

export const userRelations = relations(user, ({ many }) => ({
  items: many(item),
}))
