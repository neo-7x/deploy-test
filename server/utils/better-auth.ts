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
const hasResend = !!env.RESEND_API_KEY

function parseBool(v: string | undefined): boolean | undefined {
  if (v === undefined) return undefined
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())
}

const emailLoginEnabled = parseBool(env.AUTH_EMAIL_ENABLED) ?? !hasOAuth
// Verification auto-activates when Resend is configured; can be force-toggled.
const emailVerificationEnabled = parseBool(env.AUTH_EMAIL_VERIFICATION) ?? (emailLoginEnabled && hasResend)

if (!hasOAuth && !emailLoginEnabled) {
  throw new Error(
    '[auth] No sign-in method configured. Enable OAuth (GOOGLE_CLIENT_ID / GITHUB_CLIENT_ID) or set AUTH_EMAIL_ENABLED=true.',
  )
}

if (emailVerificationEnabled && !hasResend) {
  logger.warn('AUTH_EMAIL_VERIFICATION is enabled but RESEND_API_KEY is not set — verification mails will fail.')
}

// Use Resend's REST API directly instead of the SDK — the SDK pulls in
// @react-email/render which isn't resolvable on Cloudflare Workers.
const emailFrom = env.RESEND_FROM ?? 'onboarding@resend.dev'

async function sendEmailViaResend(to: string, subject: string, html: string): Promise<void> {
  const apiKey = env.RESEND_API_KEY
  if (!apiKey) return
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: emailFrom, to, subject, html }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    logger.error(`resend send failed (${res.status}): ${text.slice(0, 500)}`)
    throw new Error(`resend send failed with status ${res.status}`)
  }
}

const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {}
if (hasGoogle) socialProviders.google = { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET! }
if (hasGithub) socialProviders.github = { clientId: env.GITHUB_CLIENT_ID!, clientSecret: env.GITHUB_CLIENT_SECRET! }

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: emailLoginEnabled
    ? { enabled: true, requireEmailVerification: emailVerificationEnabled }
    : { enabled: false },
  emailVerification: emailVerificationEnabled
    ? {
        sendOnSignUp: true,
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, url }) => {
          await sendEmailViaResend(
            user.email,
            'Verify your email',
            `<p>Hi ${user.name || user.email},</p><p>Click <a href="${url}">here</a> to verify your email for deploy-test.</p>`,
          )
        },
      }
    : undefined,
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
  emailVerification: emailVerificationEnabled,
}
