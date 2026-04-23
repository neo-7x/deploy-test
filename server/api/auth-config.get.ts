// Public read-only summary of which sign-in methods are enabled — used by
// the LoginModal to hide provider buttons that aren't configured.
// `authConfig` is auto-imported from server/utils/better-auth.ts.
export default defineEventHandler(() => authConfig)
