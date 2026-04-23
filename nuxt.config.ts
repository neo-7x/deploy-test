// Intentionally minimal Nuxt config aimed at exercising the deploy pipeline:
//   - @nuxthub/core + hub.blob:true (triggers @vercel/blob peer on Vercel preset)
//   - Tailwind v4 + Nuxt 4 build pipeline
// Omits i18n / seo / image / shadcn — those aren't deploy concerns.
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxtjs/tailwindcss',
    '@nuxthub/core',
    // CF Workers lack a real startup phase, so the usual "migrate-before-listen"
    // pattern doesn't work. This module adds a /setup page + /api/_migrate
    // endpoints + a request middleware that redirects unmigrated requests.
    // No-op on node-server / vercel presets — those paths don't exist there.
    './modules/cf-setup/module',
  ],

  css: ['~/assets/css/tailwind.css'],

  hub: {
    // Forces the @vercel/blob peer to be resolvable at boot when
    // NITRO_PRESET=vercel. Without @vercel/blob in dependencies the
    // Vercel lambda crashes with ERR_MODULE_NOT_FOUND before serving.
    blob: true,
  },

  app: {
    head: {
      title: 'Deploy Test',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },

  // Nitro's cloudflare-module preset polyfills node:fs via unenv. Those
  // stubs throw "not implemented" for readdirSync/statSync, hiding CF
  // Workers' native node:fs (2025-09-01+) from our code. Mark them as
  // externals so Nitro leaves the import alone and CF Workers serves its
  // own node:fs at runtime.
  nitro: {
    unenv: {
      external: ['node:fs', 'node:fs/promises', 'node:path', 'node:process'],
    },
  },
})
