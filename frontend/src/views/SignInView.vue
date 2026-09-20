<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, Command, KeyRound, LockKeyhole, Mail, UserRound } from 'lucide-vue-next'
import { ApiError } from '../lib/api'
import { getOrCreateVisitorId } from '../lib/auth/visitor'
import { registerTenant, resolveTenantAfterAuth } from '../lib/auth/tenant-bootstrap'
import { authService } from '../lib/services/auth.service'
import { useSessionStore } from '../stores/session'
import CreateTenantDialog from '../components/CreateTenantDialog.vue'

type AuthMode = 'otp' | 'password'
type PasswordPanel = 'sign-in' | 'create'

const email = ref('')
const password = ref('')
const name = ref('')
const mode = ref<AuthMode>('password')
const passwordPanel = ref<PasswordPanel>('sign-in')
const busy = ref(false)
const error = ref('')
const showTenantModal = ref(false)
const tenantBusy = ref(false)
const tenantError = ref('')
const route = useRoute()
const router = useRouter()
const session = useSessionStore()

onMounted(() => {
  getOrCreateVisitorId()
  void authService.ensureVisitor().catch(() => {
    /* visitor bootstrap retried on first auth call */
  })
})

function redirectAfterAuth() {
  router.push(typeof route.query.redirect === 'string' ? route.query.redirect : '/')
}

async function finishAuth() {
  const resolution = await resolveTenantAfterAuth()
  if (resolution.requiresTenant) {
    showTenantModal.value = true
    return
  }
  redirectAfterAuth()
}

async function submitOtp() {
  busy.value = true
  error.value = ''
  try {
    const result = await authService.sendOtp(email.value.trim())
    sessionStorage.setItem('commcare.otp.email', email.value.trim())
    if (result.devOtp) sessionStorage.setItem('commcare.otp.dev', result.devOtp)
    await router.push({ name: 'otp', query: route.query.redirect ? { redirect: String(route.query.redirect) } : {} })
  } catch (caught) {
    error.value = caught instanceof ApiError ? caught.message : 'Could not send OTP.'
  } finally {
    busy.value = false
  }
}

async function submitPassword() {
  busy.value = true
  error.value = ''
  try {
    if (passwordPanel.value === 'create') {
      const result = await authService.registerPassword({
        identifier: email.value.trim(),
        password: password.value,
        name: name.value.trim(),
      })
      session.applyAuthResult(result)
      await finishAuth()
    } else {
      const result = await authService.loginPassword(email.value.trim(), password.value)
      session.applyAuthResult(result)
      await finishAuth()
    }
  } catch (caught) {
    error.value = caught instanceof ApiError ? caught.message : 'Authentication failed.'
  } finally {
    busy.value = false
  }
}

function submit() {
  if (mode.value === 'otp') return submitOtp()
  return submitPassword()
}

async function onCreateTenant(payload: { name: string; region: string }) {
  tenantBusy.value = true
  tenantError.value = ''
  try {
    await registerTenant(payload.name)
    showTenantModal.value = false
    redirectAfterAuth()
  } catch (caught) {
    tenantError.value = caught instanceof ApiError ? caught.message : 'Could not create workspace.'
  } finally {
    tenantBusy.value = false
  }
}

function onTenantSignOut() {
  session.clear()
  showTenantModal.value = false
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-aside">
      <div class="auth-aside__grid" />
      <div class="auth-brand">
        <span class="brand__mark"><Command :size="17" /></span>
        <strong>commcare</strong>
      </div>
      <div class="auth-aside__copy">
        <p class="eyebrow">Cloud PBX operations</p>
        <h1>Make every conversation count.</h1>
        <p>One calm place to route calls, manage your team, and keep your communications moving.</p>
      </div>
      <div class="auth-aside__footer">
        <span class="status-dot status-dot--good" /> All systems operational <span>·</span> v2.4.0
      </div>
    </section>

    <section class="auth-form">
      <div class="auth-form__inner">
        <div class="auth-form__header">
          <span class="overline">Welcome back</span>
          <h2>{{ passwordPanel === 'create' && mode === 'password' ? 'Create your account' : 'Sign in to your workspace' }}</h2>
          <p>Choose OTP or password authentication to continue.</p>
        </div>

        <div class="auth-mode-toggle" role="tablist" aria-label="Authentication mode">
          <button type="button" role="tab" :aria-selected="mode === 'password'" :class="{ 'is-active': mode === 'password' }" @click="mode = 'password'; passwordPanel = 'sign-in'">Password</button>
          <button type="button" role="tab" :aria-selected="mode === 'otp'" :class="{ 'is-active': mode === 'otp' }" @click="mode = 'otp'">OTP</button>
        </div>

        <form @submit.prevent="submit">
          <label v-if="mode === 'password' && passwordPanel === 'create'">
            Full name
            <span class="field">
              <UserRound :size="16" />
              <input v-model="name" type="text" autocomplete="name" required />
            </span>
          </label>

          <label>
            Email address
            <span class="field">
              <Mail :size="16" />
              <input v-model="email" type="email" autocomplete="email" required />
            </span>
          </label>

          <label v-if="mode === 'password'">
            Password
            <span class="field">
              <LockKeyhole :size="16" />
              <input v-model="password" type="password" :autocomplete="passwordPanel === 'create' ? 'new-password' : 'current-password'" :placeholder="passwordPanel === 'create' ? 'At least 8 characters' : 'Enter your password'" minlength="8" required />
            </span>
          </label>

          <p v-if="mode === 'otp'" class="field-hint">We'll email a one-time code. A new account is created automatically if you don't have one yet.</p>

          <p v-if="error" class="auth-error" role="alert">{{ error }}</p>

          <button class="button button--primary button--wide" type="submit" :disabled="busy">
            <template v-if="busy">Please wait...</template>
            <template v-else-if="mode === 'otp'">Send code <KeyRound :size="16" /></template>
            <template v-else-if="passwordPanel === 'create'">Create account <ArrowRight :size="16" /></template>
            <template v-else>Continue <ArrowRight :size="16" /></template>
          </button>
        </form>

        <p v-if="mode === 'password'" class="auth-form__switch">
          <template v-if="passwordPanel === 'sign-in'">
            Need an account?
            <button type="button" class="link-button" @click="passwordPanel = 'create'; error = ''">Create one</button>
          </template>
          <template v-else>
            Already registered?
            <button type="button" class="link-button" @click="passwordPanel = 'sign-in'; error = ''">Sign in</button>
          </template>
        </p>

        <p class="auth-form__note">By continuing, you agree to your organization's security policy.</p>
      </div>
    </section>

    <CreateTenantDialog
      :open="showTenantModal"
      :submitting="tenantBusy"
      :error="tenantError"
      @submit="onCreateTenant"
      @sign-out="onTenantSignOut"
    />
  </main>
</template>
