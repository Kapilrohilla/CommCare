import { ApiError } from '../api'
import { authService, type AuthProfile } from '../services/auth.service'
import { tenancyService } from '../services/tenancy.service'
import type { AuthSessionResult } from '../../stores/session'
import { useSessionStore } from '../../stores/session'

export type TenantResolution = {
  requiresTenant: boolean
  profile: AuthProfile
}

/** After sign-up/sign-in: load profile + my tenant; mark session if registration is required. */
export async function resolveTenantAfterAuth(): Promise<TenantResolution> {
  const session = useSessionStore()
  const profile = await authService.me()
  session.applyProfile(profile)

  if (profile.requiresTenant || !profile.user.tenantId) {
    session.setRequiresTenant(true)
    return { requiresTenant: true, profile }
  }

  try {
    const tenant = await tenancyService.getMyTenant()
    session.applyTenant({ id: tenant.id, name: tenant.name })
    return { requiresTenant: false, profile }
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 404) {
      session.setRequiresTenant(true)
      return { requiresTenant: true, profile }
    }
    throw caught
  }
}

export async function registerTenant(name: string): Promise<AuthSessionResult> {
  const session = useSessionStore()
  const result = await tenancyService.createMyTenant(name)
  session.applyAuthResult(result)
  session.setRequiresTenant(false)
  return result
}
