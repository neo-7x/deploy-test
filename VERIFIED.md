# Verified

Local verification report for the deploy-test PoC.

## Build-time verification

| Preset | Result |
|---|---|
| `node-server` (default `pnpm build`) | ✅ clean, ~8 MB output |
| `vercel` (`pnpm build:vercel`) | ✅ clean, `.vercel/output/functions/__fallback.func/` produced |
| `cloudflare-module` (`pnpm build:cf`) | ✅ clean, wrangler can `deploy` the `.output/` directly |

All three presets succeed in isolation — the `@vercel/blob` ERR_MODULE_NOT_FOUND
class of issues that trip Nuxt-on-Vercel is headed off by declaring the
package in `dependencies` from day one.

## Runtime verification (node-server / Docker)

Built the image (`docker build -t deploy-test:local .`), ran against a fresh
`pgvector/pgvector:pg17` Postgres container.

| Check | Result |
|---|---|
| `[migrate]` plugin applies 0000 + 0001 migrations | ✅ |
| `[seed-admin]` creates `admin@deploy-test.local` after migrations complete | ✅ |
| `/health` returns `{status:"ok"}` | ✅ |
| `/api/items` returns 3 seeded items | ✅ |
| `/api/auth-config` returns `{google:false, github:false, email:true, emailVerification:false}` | ✅ |
| `POST /api/auth/sign-in/email` with admin creds | ✅ token + admin role |
| `GET /api/auth/get-session` with cookie | ✅ returns user + session |

## Runtime verification (dev server + Playwright)

`pnpm dev` against the same fresh DB, driven via a real browser:

- Home page renders 3 seeded items ✅
- Click **Sign in** → modal opens directly on email form (no OAuth configured,
  so no chooser) ✅
- Submit `admin@deploy-test.local` / `changedefaultpassword` → session established,
  user menu shows email + Sign out ✅
- **Add item** form appears for signed-in users only ✅
- Submit a new item → POST /api/items → new item appears at top of the list,
  authored by `seed-admin-default` ✅

## Two findings worth remembering

### 1. `better-auth` 1.6.x breaks `cloudflare-module` build

Symptom on a fresh install (pnpm resolves `^1.5.4` to `1.6.7` today):

```
[nitro] ERROR Cannot resolve "@opentelemetry/api" from
"node_modules/@better-auth/core/dist/instrumentation/api.mjs"
and externals are not allowed!
```

The 1.6 series introduced an OpenTelemetry instrumentation module that isn't
compatible with Nitro's Cloudflare Workers bundler (no externals allowed on
that preset, and `@opentelemetry/api` pulls in Node APIs).

**Workaround**: pin `"better-auth": "1.5.4"` exactly in `package.json`.
`pnpm build:cf` succeeds after the pin.

### 2. `seed-admin` and `migrate` as separate Nitro plugins race each other

When split into two plugin files (`migrate.ts` + `seed-admin.ts`), Nitro's
plugin loader does not await them sequentially — `seed-admin` queries the
`user` table before `migrate` has finished creating it:

```
[migrate]  ℹ Starting database migration...
[migrate]  ℹ Migrations folder: ...
[seed-admin]  ERROR  Failed to seed default admin: relation "user" does not exist
[migrate]  ✔ Database migration completed
```

**Fix**: merge both into one plugin (`server/plugins/migrate.ts`) so the
admin seed runs after `await migrate(...)` returns. The single-plugin file
is explicit about the ordering requirement in its top comment.

The race only affects the `node-server` preset (Docker) — on Vercel the
migration runs at build time via `vercel.json`, and Cloudflare Workers
migrates out-of-band before `wrangler deploy`.

## Known limits of this PoC

- **Cloudflare Workers end-to-end deploy** was not verified — only the build.
  Wrangler auth + Hyperdrive + R2 binding require live CF account access.
- `@vercel/blob` is in dependencies but no Vercel Blob token is configured.
  This PoC doesn't ship file-upload endpoints; add a real token if exercising
  blob storage.
- Preview deployments on Vercel re-run `pnpm migrate` on every PR build.
  Idempotent against an empty or up-to-date DB.
