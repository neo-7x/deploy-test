import type { H3Event } from 'h3'
import { auth } from './better-auth'

export async function getUserSession(event: H3Event) {
  const headers = new Headers()
  for (const [k, v] of Object.entries(getRequestHeaders(event))) {
    if (v) headers.set(k, Array.isArray(v) ? v.join(',') : v)
  }
  return auth.api.getSession({ headers })
}

export async function requireAuth(event: H3Event) {
  const session = await getUserSession(event)
  if (!session) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  return session
}
