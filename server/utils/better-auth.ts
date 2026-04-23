import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'
import { consola } from 'consola'
import { db } from '../db'

// Conditional-provider wiring: a provider is only registered when the matching
// client id + secret env vars are set. If neither OAuth is configured,
// email+password login auto-enables so a fresh install is never locked out.
const env = process.env
const logger = consola.withTag('auth')

// First-admin-wins: whichever sign-up lands an email that matches this list
// becomes role=admin on user creation. Default points at `admin@local` so the
// PoC is usable before the operator customizes it — change this to your own
// email before inviting anyone.
const DEFAULT_ADMIN_EMAIL = 'admin@admin.local'
const systemAdminEmails = (env.SYSTEM_ADMIN_EMAILS ?? DEFAULT_ADMIN_EMAIL)
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

if (!env.SYSTEM_ADMIN_EMAILS) {
  logger.warn(
    `SYSTEM_ADMIN_EMAILS is unset. Falling back to '${DEFAULT_ADMIN_EMAIL}' — sign up with that email to claim admin, or set SYSTEM_ADMIN_EMAILS to your own email before exposing this deploy publicly.`,
  )
}

const hasGoogle = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
const hasGithub = !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET)
const hasOAuth  = hasGoogle || hasGithub

function parseBool(v: string | undefined): boolean | undefined {
  if (v === undefined) return undefined
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())
}

const emailLoginEnabled = parseBool(env.AUTH_EMAIL_ENABLED) ?? !hasOAuth

if (!hasOAuth && !emailLoginEnabled) {
  throw new Error(
    '[auth] No sign-in method configured. Enable OAuth (GOOGLE_CLIENT_ID / GITHUB_CLIENT_ID) or set AUTH_EMAIL_ENABLED=true.',
  )
}

const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {}
if (hasGoogle) socialProviders.google = { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET! }
if (hasGithub) socialProviders.github = { clientId: env.GITHUB_CLIENT_ID!, clientSecret: env.GITHUB_CLIENT_SECRET! }

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: emailLoginEnabled
    ? { enabled: true, requireEmailVerification: false }
    : { enabled: false },
  socialProviders,
  plugins: [admin()],
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (systemAdminEmails.includes(user.email)) {
            return { data: { ...user, role: 'admin' } }
          }
          return { data: user }
        },
      },
    },
  },
})

export const authConfig = {
  google: hasGoogle,
  github: hasGithub,
  email: emailLoginEnabled,
  emailVerification: false,
}
