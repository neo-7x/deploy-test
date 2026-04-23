import { addServerHandler, createResolver, defineNuxtModule } from '@nuxt/kit'

// Patch module for Cloudflare Workers.
//
// CF Workers have no real "startup phase": async work at module init is not
// tied to the fetch lifecycle and dies when the first request returns. That
// breaks the usual "migrate DB before listen" pattern. This module adds a
// CF-only /setup page + /api/_migrate endpoints + a request hook that
// detects unmigrated state and redirects to /setup.
//
// The module is a no-op on non-Cloudflare presets, so Docker and Vercel
// builds neither bundle these routes nor register the hook.

export default defineNuxtModule({
  meta: {
    name: 'cf-setup',
    configKey: 'cfSetup',
  },
  setup(_options, nuxt) {
    const preset = process.env.NITRO_PRESET ?? nuxt.options.nitro?.preset ?? ''
    const isCloudflare =
      typeof preset === 'string' &&
      (preset.startsWith('cloudflare') || preset.startsWith('cloudflare_'))

    if (!isCloudflare) {
      return
    }

    const resolver = createResolver(import.meta.url)

    // /setup is served as pure HTML from a server route — no Vue runtime,
    // no hydration, works on the very first cold request.
    addServerHandler({
      route: '/setup',
      method: 'get',
      handler: resolver.resolve('./runtime/server/routes/setup.get.ts'),
    })

    addServerHandler({
      route: '/api/_migrate/status',
      method: 'get',
      handler: resolver.resolve('./runtime/server/api/_migrate/status.get.ts'),
    })

    addServerHandler({
      route: '/api/_migrate/run',
      method: 'post',
      handler: resolver.resolve('./runtime/server/api/_migrate/run.post.ts'),
    })

    addServerHandler({
      handler: resolver.resolve('./runtime/server/middleware/migrate-check.ts'),
      middleware: true,
    })
  },
})
