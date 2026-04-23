-- Data-only migration: seeds a sentinel user + 3 welcome items.
-- Each INSERT is gated on the target table being empty so upgrades on
-- existing installs are a no-op — the migration only populates a fresh DB.
--
-- The 'system' user has no account row, so it cannot log in; it only
-- satisfies the NOT NULL author_id text column on item.

INSERT INTO "user" ("id", "name", "email", "email_verified", "created_at", "updated_at")
VALUES ('system', 'Deploy Test', 'system@deploy-test.local', true, now(), now())
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint

INSERT INTO "item" ("id", "author_id", "title", "description", "created_at", "updated_at")
SELECT * FROM (VALUES
  ('00000000-0000-4000-d0e1-000000000001'::uuid, 'system', 'Your deploy is live',        'If you can see this row, migrations ran and the database is wired up correctly.', now(), now()),
  ('00000000-0000-4000-d0e1-000000000002'::uuid, 'system', 'Next: sign in',              'Click the Sign in button. The default admin (if you set SEED_DEFAULT_ADMIN=true) is admin@deploy-test.local / changedefaultpassword.', now(), now()),
  ('00000000-0000-4000-d0e1-000000000003'::uuid, 'system', 'Then: create a real item',   'Once signed in, POST to /api/items with a title and description. That round-trips through Drizzle into the database.', now(), now())
) AS v(id, author_id, title, description, created_at, updated_at)
WHERE NOT EXISTS (SELECT 1 FROM "item");
