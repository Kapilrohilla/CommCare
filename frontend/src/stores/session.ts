import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { clearSessionTokens, getAccessToken, setSessionTokens } from '../lib/auth/tokens'
import type { AuthProfile } from '../lib/services/auth.service'

const PROFILE_KEY = 'commcare.session.profile'
const DEMO_KEY = 'commcare.session'

export type SessionProfile = {
  user: string
  userId: string
  tenant: string
  tenantId: string | null
  role: string
  sessionId: string
  requiresTenant: boolean
}

export type AuthSessionResult = {
  accessToken: string
  refreshToken: string
  sessionId: string
  expiresAt?: string
  user: { id: string; name: string; tenantId: string | null }
  tenant: { id: string; name: string } | null
  requiresTenant: boolean
}

function readProfile(): SessionProfile | null {
  localStorage.removeItem(DEMO_KEY)
  const raw = localStorage.getItem(PROFILE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionProfile
  } catch {
    localStorage.removeItem(PROFILE_KEY)
    return null
  }
}

function persist(profile: SessionProfile | null) {
  if (!profile) {
    localStorage.removeItem(PROFILE_KEY)
    return
  }
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

export const useSessionStore = defineStore('session', () => {
  const profile = ref<SessionProfile | null>(readProfile())

  const current = computed(() => {
    if (!profile.value) return null
    return {
      ...profile.value,
      token: getAccessToken() ?? '',
    }
  })

  const isAuthenticated = computed(() => Boolean(getAccessToken() && profile.value))
  const requiresTenant = computed(() => Boolean(profile.value?.requiresTenant || (profile.value && !profile.value.tenantId)))

  function applyAuthResult(result: AuthSessionResult) {
    setSessionTokens(result.accessToken, result.refreshToken)
    const next: SessionProfile = {
      user: result.user.name,
      userId: result.user.id,
      tenant: result.tenant?.name ?? 'Workspace',
      tenantId: result.user.tenantId,
      role: 'Administrator',
      sessionId: result.sessionId,
      requiresTenant: result.requiresTenant,
    }
    profile.value = next
    persist(next)
  }

  function applyProfile(authProfile: AuthProfile) {
    if (!profile.value) {
      const next: SessionProfile = {
        user: authProfile.user.name,
        userId: authProfile.user.id,
        tenant: authProfile.tenant?.name ?? 'Workspace',
        tenantId: authProfile.user.tenantId,
        role: 'Administrator',
        sessionId: authProfile.sessionId,
        requiresTenant: authProfile.requiresTenant,
      }
      profile.value = next
      persist(next)
      return
    }
    profile.value = {
      ...profile.value,
      user: authProfile.user.name,
      userId: authProfile.user.id,
      tenant: authProfile.tenant?.name ?? profile.value.tenant,
      tenantId: authProfile.user.tenantId,
      sessionId: authProfile.sessionId,
      requiresTenant: authProfile.requiresTenant,
    }
    persist(profile.value)
  }

  function applyTenant(tenant: { id: string; name: string }) {
    if (!profile.value) return
    profile.value = {
      ...profile.value,
      tenant: tenant.name,
      tenantId: tenant.id,
      requiresTenant: false,
    }
    persist(profile.value)
  }

  function setRequiresTenant(value: boolean) {
    if (!profile.value) return
    profile.value = { ...profile.value, requiresTenant: value }
    persist(profile.value)
  }

  function clear() {
    profile.value = null
    persist(null)
    localStorage.removeItem(DEMO_KEY)
    clearSessionTokens()
  }

  return {
    current,
    profile,
    isAuthenticated,
    requiresTenant,
    applyAuthResult,
    applyProfile,
    applyTenant,
    setRequiresTenant,
    clear,
  }
})
