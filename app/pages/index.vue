<script setup lang="ts">
import { authClient } from '~/lib/auth-client'

interface Item {
  id: string
  title: string
  description: string
  authorId: string
  createdAt: string
}

interface AuthMethods {
  google: boolean
  github: boolean
  email: boolean
  emailVerification: boolean
}

interface Session {
  user: { id: string; name: string; email: string; role: string | null }
}

const { data: itemsRes, refresh: refreshItems } = await useFetch<{ data: Item[] }>('/api/items', { key: 'items' })
const { data: session, refresh: refreshSession } = await useFetch<Session | null>('/api/auth/get-session', { key: 'session' })
const { data: authCfg } = await useFetch<AuthMethods>('/api/auth-config', {
  key: 'auth-config',
  default: () => ({ google: false, github: false, email: true, emailVerification: false }),
})

const loginOpen = ref(false)
const loginError = ref('')
const loginLoading = ref(false)
const form = reactive({ email: 'admin@deploy-test.local', password: 'changedefaultpassword' })

async function handleEmailSignIn() {
  loginError.value = ''
  loginLoading.value = true
  try {
    const { error } = await authClient.signIn.email({
      email: form.email,
      password: form.password,
    })
    if (error) {
      loginError.value = error.message || 'Sign in failed'
      return
    }
    loginOpen.value = false
    await refreshSession()
  } finally {
    loginLoading.value = false
  }
}

async function signOut() {
  await authClient.signOut()
  await refreshSession()
}

const addTitle = ref('')
const addDescription = ref('')
const addError = ref('')
const addLoading = ref(false)

async function addItem() {
  if (!addTitle.value.trim() || !addDescription.value.trim()) return
  addError.value = ''
  addLoading.value = true
  try {
    await $fetch('/api/items', {
      method: 'POST',
      body: { title: addTitle.value, description: addDescription.value },
    })
    addTitle.value = ''
    addDescription.value = ''
    await refreshItems()
  } catch (e: unknown) {
    addError.value = (e as { statusMessage?: string; message?: string }).statusMessage
      || (e as { message?: string }).message
      || 'Failed to add item'
  } finally {
    addLoading.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto px-6 py-12 space-y-8">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Deploy Test</h1>
        <p class="text-sm text-neutral-500 mt-1">Nuxt 4 · Postgres · better-auth — minimal stack for deploy validation.</p>
      </div>
      <div>
        <template v-if="session">
          <div class="flex items-center gap-3">
            <span class="text-sm text-neutral-600">{{ session.user.email }}</span>
            <button class="text-sm text-neutral-500 hover:text-neutral-900 underline" @click="signOut">Sign out</button>
          </div>
        </template>
        <template v-else>
          <button
            class="px-4 py-2 text-sm font-medium bg-neutral-900 text-white rounded hover:bg-neutral-700"
            @click="loginOpen = true"
          >
            Sign in
          </button>
        </template>
      </div>
    </header>

    <section class="bg-white border border-neutral-200 rounded-lg p-6 space-y-4">
      <h2 class="text-lg font-medium">Items ({{ itemsRes?.data.length || 0 }})</h2>
      <ul v-if="itemsRes?.data.length" class="divide-y divide-neutral-100">
        <li v-for="row in itemsRes.data" :key="row.id" class="py-3">
          <div class="font-medium">{{ row.title }}</div>
          <div class="text-sm text-neutral-600 mt-1">{{ row.description }}</div>
          <div class="text-xs text-neutral-400 mt-1">by {{ row.authorId }} · {{ new Date(row.createdAt).toLocaleString() }}</div>
        </li>
      </ul>
      <p v-else class="text-sm text-neutral-500">No items yet.</p>
    </section>

    <section v-if="session" class="bg-white border border-neutral-200 rounded-lg p-6 space-y-3">
      <h3 class="font-medium">Add item</h3>
      <input
        v-model="addTitle"
        placeholder="Title"
        class="w-full px-3 py-2 border border-neutral-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
      >
      <textarea
        v-model="addDescription"
        placeholder="Description"
        rows="3"
        class="w-full px-3 py-2 border border-neutral-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
      />
      <p v-if="addError" class="text-sm text-red-600">{{ addError }}</p>
      <button
        class="px-4 py-2 text-sm font-medium bg-neutral-900 text-white rounded hover:bg-neutral-700 disabled:opacity-50"
        :disabled="addLoading"
        @click="addItem"
      >
        {{ addLoading ? 'Adding...' : 'Add' }}
      </button>
    </section>

    <!-- Login modal -->
    <div
      v-if="loginOpen"
      class="fixed inset-0 bg-black/40 flex items-center justify-center p-4"
      @click.self="loginOpen = false"
    >
      <div class="bg-white rounded-lg max-w-sm w-full p-6 space-y-4">
        <h3 class="text-lg font-semibold">Sign in</h3>

        <template v-if="authCfg?.google || authCfg?.github">
          <div class="space-y-2">
            <button
              v-if="authCfg?.google"
              class="w-full px-4 py-2 border border-neutral-200 rounded text-sm hover:bg-neutral-50"
            >
              Continue with Google
            </button>
            <button
              v-if="authCfg?.github"
              class="w-full px-4 py-2 border border-neutral-200 rounded text-sm hover:bg-neutral-50"
            >
              Continue with GitHub
            </button>
          </div>
          <div v-if="authCfg?.email" class="text-center text-xs text-neutral-500">or</div>
        </template>

        <template v-if="authCfg?.email">
          <form class="space-y-3" @submit.prevent="handleEmailSignIn">
            <input
              v-model="form.email"
              type="email"
              placeholder="Email"
              required
              class="w-full px-3 py-2 border border-neutral-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            >
            <input
              v-model="form.password"
              type="password"
              placeholder="Password"
              required
              class="w-full px-3 py-2 border border-neutral-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            >
            <p v-if="loginError" class="text-sm text-red-600">{{ loginError }}</p>
            <button
              type="submit"
              class="w-full px-4 py-2 bg-neutral-900 text-white rounded text-sm font-medium hover:bg-neutral-700 disabled:opacity-50"
              :disabled="loginLoading"
            >
              {{ loginLoading ? 'Signing in...' : 'Sign in' }}
            </button>
          </form>
        </template>

        <p v-if="!authCfg?.email && !authCfg?.google && !authCfg?.github" class="text-sm text-red-600">
          No sign-in method is configured. Set SEED_DEFAULT_ADMIN=true or OAuth env vars.
        </p>

        <button
          class="w-full text-sm text-neutral-500 hover:text-neutral-900"
          @click="loginOpen = false"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>
