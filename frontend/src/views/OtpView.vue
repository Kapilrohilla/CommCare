<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, Command, KeyRound, Mail } from 'lucide-vue-next'
import { ApiError } from '../lib/api'
import { registerTenant, resolveTenantAfterAuth } from '../lib/auth/tenant-bootstrap'
import { authService } from '../lib/services/auth.service'
import { useSessionStore } from '../stores/session'
import CreateTenantDialog from '../components/CreateTenantDialog.vue'

const email = ref('')
const otp = ref('')
const busy = ref(false)
const error = ref('')
const hint = ref('')
const showTenantModal = ref(false)
const tenantBusy = ref(false)
const tenantError = ref('')
const route = useRoute()
const router = useRouter()
const session = useSessionStore()

onMounted(() => {
  email.value = sessionStorage.getItem('commcare.otp.email') ?? ''
  const devOtp = sessionStorage.getItem('commcare.otp.dev')
  if (devOtp) hint.value = `Local OTP: ${devOtp}`
  if (!email.value) router.replace({ name: 'sign-in' })
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

async function submit() {
  busy.value = true
  error.value = ''
  try {
    const result = await authService.verifyOtp(email.value.trim(), otp.value.trim())
    session.applyAuthResult(result)
    sessionStorage.removeItem('commcare.otp.email')
    sessionStorage.removeItem('commcare.otp.dev')
    await finishAuth()
  } catch (caught) {
    error.value = caught instanceof ApiError ? caught.message : 'Invalid code.'
  } finally {
    busy.value = false
  }
}

async function resend() {
  busy.value = true
  error.value = ''
  try {
    const result = await authService.sendOtp(email.value.trim())
    if (result.devOtp) {
      sessionStorage.setItem('commcare.otp.dev', result.devOtp)
      hint.value = `Local OTP: ${result.devOtp}`
    }
  } catch (caught) {
    error.value = caught instanceof ApiError ? caught.message : 'Could not resend OTP.'
  } finally {
    busy.value = false
  }
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
  router.replace({ name: 'sign-in' })
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
        <p class="eyebrow">Verify identity</p>
        <h1>Enter the code we sent.</h1>
        <p>Use the one-time passcode from your email to finish signing in.</p>
      </div>
    </section>

    <section class="auth-form">
      <div class="auth-form__inner">
        <div class="auth-form__header">
          <span class="overline">Almost there</span>
          <h2>Check your inbox</h2>
          <p>Code sent to <strong>{{ email }}</strong></p>
        </div>

        <form @submit.prevent="submit">
          <label>
            Email
            <span class="field">
              <Mail :size="16" />
              <input :value="email" type="email" readonly />
            </span>
          </label>
          <label>
            One-time code
            <span class="field">
              <KeyRound :size="16" />
              <input v-model="otp" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" placeholder="6-digit code" required />
            </span>
          </label>

          <p v-if="hint" class="field-hint">{{ hint }}</p>
          <p v-if="error" class="auth-error" role="alert">{{ error }}</p>

          <button class="button button--primary button--wide" type="submit" :disabled="busy">
            {{ busy ? 'Verifying...' : 'Verify and continue' }} <ArrowRight :size="16" />
          </button>
        </form>

        <p class="auth-form__switch">
          <button type="button" class="link-button" :disabled="busy" @click="resend">Resend code</button>
          ·
          <RouterLink :to="{ name: 'sign-in' }">Back to sign in</RouterLink>
        </p>
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
