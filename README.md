# deploy-test

Minimal **Nuxt 4 + Postgres + better-auth** starter, built as a harness for
validating one-click deploy flows (Vercel / Cloudflare Workers / Docker)
without needing to expose any real application code.

The stack intentionally mirrors a larger private project 1:1 on every axis
that touches the deploy pipeline:

- Nuxt 4 + Nitro with the three presets: `node-server`, `vercel`, `cloudflare-module`
- `@nuxthub/core` with `hub.blob: true` (and `@vercel/blob` as a peer)
- Drizzle ORM + `postgres-js` driver
- Migration-based schema plus a data-only seed migration with `WHERE NOT EXISTS`
- `better-auth` with conditional OAuth providers + email toggle + opt-in default admin
- Tailwind v4 build pipeline
- `vercel.json` with build-time migrate

It **excludes** anything that isn't a deploy concern (i18n, SEO, rich-text
editor, business features).

## One-click deploy

Replace `<your-github>/<repo>` below with the GitHub URL you push this PoC to.

### Vercel

```
https://vercel.com/new/clone
  ?repository-url=https%3A%2F%2Fgithub.com%2F<your-github>%2F<repo>
  &project-name=deploy-test
  &repository-name=deploy-test
  &env=DATABASE_URL,BETTER_AUTH_SECRET
  &envDescription=DATABASE_URL%3A%20Postgres%20connection%20string%20(Neon%20or%20Supabase%20from%20the%20Vercel%20Marketplace%20works%20out%20of%20the%20box).%20BETTER_AUTH_SECRET%3A%2032%2B%20char%20random%20string%20(%60openssl%20rand%20-hex%2032%60).
  &envLink=https%3A%2F%2Fgithub.com%2F<your-github>%2F<repo>%2Fblob%2Fmain%2FREADME.md
```

Also set `SEED_DEFAULT_ADMIN=true` if you want an instant-login admin account.

Build-time migration is wired in `vercel.json` — `pnpm migrate && pnpm build`.
If the migration fails, the deploy fails loud, leaving the previous version
serving traffic.

### Cloudflare Workers

```
wrangler login
pnpm install
pnpm build:cf
wrangler --cwd .output deploy
wrangler secret put DATABASE_URL
wrangler secret put BETTER_AUTH_SECRET
```

### Docker

```
docker run -d -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e BETTER_AUTH_SECRET=$(openssl rand -hex 32) \
  -e SEED_DEFAULT_ADMIN=true \
  <your-image>
```

## Minimum config

| Variable | Required? | Purpose |
|---|---|---|
| `DATABASE_URL` | **yes** | Postgres connection string |
| `BETTER_AUTH_SECRET` | **yes** | 32+ char random string |
| `SEED_DEFAULT_ADMIN` | no | `true` seeds `admin@deploy-test.local` / `changedefaultpassword` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | Google OAuth |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | no | GitHub OAuth |
| `AUTH_EMAIL_ENABLED` | no | Force-toggle email login |

With just the two required variables + `SEED_DEFAULT_ADMIN=true`, a fresh
deploy boots, auto-seeds 3 welcome items + an admin account, and is
immediately loginable.

## Local dev

```
pnpm install
cp .env.example .env   # fill DATABASE_URL + BETTER_AUTH_SECRET
pnpm migrate
pnpm dev               # http://localhost:3000
```
