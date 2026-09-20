import { request } from '../api'
import { getRefreshToken } from '../auth/tokens'
import { ensureVisitorToken } from '../auth/visitor-bootstrap'
import type { AuthSessionResult } from '../../stores/session'

export type { AuthSessionResult }

export type SendOtpResult = {
  identityId: string
  message: string
  devOtp?: string
}

export type AuthProfile = {
  user: { id: string; name: string; tenantId: string | null; status?: string }
  tenant: { id: string; name: string } | null
  requiresTenant: boolean
  sessionId: string
}

export const authService = {
  ensureVisitor: () => ensureVisitorToken(),

  sendOtp: (identifier: string) =>
    request<SendOtpResult>('/auth/otp/send', {
      method: 'POST',
      auth: 'visitor',
      body: JSON.stringify({ identifier, identifierType: 'email' }),
    }),

  verifyOtp: (identifier: string, otp: string, name?: string) =>
    request<AuthSessionResult>('/auth/otp/verify', {
      method: 'POST',
      auth: 'visitor',
      body: JSON.stringify({
        identifier,
        identifierType: 'email',
        otp,
        ...(name ? { name } : {}),
      }),
    }),

  registerPassword: (payload: { identifier: string; password: string; name: string }) =>
    request<AuthSessionResult>('/auth/password/register', {
      method: 'POST',
      auth: 'visitor',
      body: JSON.stringify({
        identifier: payload.identifier,
        identifierType: 'email',
        password: payload.password,
        name: payload.name,
      }),
    }),

  loginPassword: (identifier: string, password: string) =>
    request<AuthSessionResult>('/auth/password/login', {
      method: 'POST',
      auth: 'visitor',
      body: JSON.stringify({
        identifier,
        identifierType: 'email',
        password,
      }),
    }),

  refresh: () => {
    const refreshToken = getRefreshToken()
    if (!refreshToken) return Promise.reject(new Error('No refresh token'))
    return request<{ accessToken: string }>('/auth/refresh', {
      method: 'POST',
      token: refreshToken,
    })
  },

  me: () => request<AuthProfile>('/auth/me', { auth: 'access' }),

  logout: () => request<unknown>('/auth/logout', { method: 'POST', auth: 'access' }),
}
