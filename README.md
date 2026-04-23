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
- Optional Resend-powered email verification (REST API, no SDK — SDK breaks on
  Cloudflare Workers)
- Cloudflare Hyperdrive binding for Postgres on the Workers preset
- Tailwind v4 build pipeline
- `vercel.json` with build-time migrate

It **excludes** anything that isn't a deploy concern (i18n, SEO, rich-text
editor, business features).

## One-click deploy

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fneo-7x%2Fdeploy-test&project-name=deploy-test&repository-name=deploy-test&env=DATABASE_URL,BETTER_AUTH_SECRET,SYSTEM_ADMIN_EMAILS&envDescription=DATABASE_URL%3A%20Postgres%20connection%20string.%20BETTER_AUTH_SECRET%3A%2032%2B%20char%20random%20string%20(%60openssl%20rand%20-hex%2032%60).%20SYSTEM_ADMIN_EMAILS%3A%20your%20email%20%E2%80%94%20signing%20up%20with%20it%20auto-promotes%20you%20to%20admin.&envLink=https%3A%2F%2Fgithub.com%2Fneo-7x%2Fdeploy-test%2Fblob%2Fmain%2FREADME.md)

Build-time migration is wired in `vercel.json` — `pnpm migrate && pnpm build`.
If the migration fails, the deploy fails loud, leaving the previous version
serving traffic.

### Cloudflare Workers

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/neo-7x/deploy-test)

Cloudflare Workers reads `wrangler.toml` for bindings. You'll be prompted for
the Hyperdrive binding and the required secrets (`BETTER_AUTH_SECRET`,
`SYSTEM_ADMIN_EMAILS`) during the deploy flow. Create the Hyperdrive config
first:

```
wrangler hyperdrive create deploy-test \
  --connection-string="postgresql://USER:PASS@HOST:5432/DB"
```

Then run the migrations once from your machine against the same Postgres
(Workers Builds doesn't run migrations at deploy-time):

```
DATABASE_URL=postgresql://USER:PASS@HOST:5432/DB pnpm migrate
```

### Docker

```
docker run -d -p 3000:3000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e BETTER_AUTH_SECRET=$(openssl rand -hex 32) \
  -e SYSTEM_ADMIN_EMAILS=you@example.com \
  ghcr.io/neo-7x/deploy-test:latest
```

## Minimum config

| Variable | Required? | Purpose |
|---|---|---|
| `DATABASE_URL` | **yes** (except CF, which uses Hyperdrive binding) | Postgres connection string |
| `BETTER_AUTH_SECRET` | **yes** | 32+ char random string |
| `SYSTEM_ADMIN_EMAILS` | recommended | Comma-separated emails. First sign-up with a matching email becomes admin. Defaults to `admin@admin.local`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | Google OAuth. Redirect URI: `https://<host>/api/auth/callback/google`. |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | no | GitHub OAuth. Callback URL: `https://<host>/api/auth/callback/github`. GitHub OAuth apps only allow one callback URL per app, so a separate app per deploy target is required. |
| `AUTH_EMAIL_ENABLED` | no | Force-toggle email+password. Defaults to: enabled iff no OAuth is configured. |
| `RESEND_API_KEY` | no | When set, email verification auto-activates on signup. Without a verified custom domain, Resend's sandbox (`onboarding@resend.dev`) only delivers to the account owner's inbox. |
| `RESEND_FROM` | no | From address for verification mails. Defaults to `onboarding@resend.dev`. |
| `AUTH_EMAIL_VERIFICATION` | no | Force-toggle email verification. Defaults to: enabled iff email login is on and `RESEND_API_KEY` is set. |

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
