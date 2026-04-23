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
})
