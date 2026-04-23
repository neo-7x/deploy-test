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
- `better-auth` with conditional OAuth providers + email toggle +
  `SYSTEM_ADMIN_EMAILS`-driven first-admin-wins (no seed credentials, no
  default password)
- Cloudflare Hyperdrive binding for Postgres on the Workers preset
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
  &env=DATABASE_URL,BETTER_AUTH_SECRET,SYSTEM_ADMIN_EMAILS
  &envDescription=DATABASE_URL%3A%20Postgres%20connection%20string.%20BETTER_AUTH_SECRET%3A%2032%2B%20char%20random%20string%20(%60openssl%20rand%20-hex%2032%60).%20SYSTEM_ADMIN_EMAILS%3A%20your%20email%20—%20signing%20up%20with%20it%20auto-promotes%20you%20to%20admin.
  &envLink=https%3A%2F%2Fgithub.com%2F<your-github>%2F<repo>%2Fblob%2Fmain%2FREADME.md
```

Build-time migration is wired in `vercel.json` — `pnpm migrate && pnpm build`.
If the migration fails, the deploy fails loud, leaving the previous version
serving traffic.

### Cloudflare Workers

```
wrangler login
pnpm install
# Create a Hyperdrive config pointing at your Postgres, paste the id into
# wrangler.toml, then:
pnpm build:cf
wrangler --cwd .output deploy
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put SYSTEM_ADMIN_EMAILS   # recommended: your email
```

### Docker

```
docker run -d -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e BETTER_AUTH_SECRET=$(openssl rand -hex 32) \
  -e SYSTEM_ADMIN_EMAILS=you@example.com \
  <your-image>
```

## Minimum config

| Variable | Required? | Purpose |
|---|---|---|
| `DATABASE_URL` | **yes** (except CF, which uses Hyperdrive binding) | Postgres connection string |
| `BETTER_AUTH_SECRET` | **yes** | 32+ char random string |
| `SYSTEM_ADMIN_EMAILS` | recommended | Comma-separated emails. First sign-up with a matching email becomes admin. Defaults to `admin@admin.local`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | Google OAuth |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | no | GitHub OAuth |
| `AUTH_EMAIL_ENABLED` | no | Force-toggle email+password. Defaults to: enabled iff no OAuth is configured. |
| `NUXT_RESEND_API_KEY` | no | When set, email verification auto-activates on signup. |

With just the two required variables, a fresh deploy boots, auto-seeds 3
welcome items, and is immediately usable. To claim admin: sign up with an
email in `SYSTEM_ADMIN_EMAILS` (default `admin@admin.local`) — the first user
created with a matching email is promoted to `role=admin` on creation.
**Change `SYSTEM_ADMIN_EMAILS` to your own email before inviting anyone.**

## Local dev

```
pnpm install
cp .env.example .env   # fill DATABASE_URL + BETTER_AUTH_SECRET + SYSTEM_ADMIN_EMAILS
pnpm migrate
pnpm dev               # http://localhost:3000
```
