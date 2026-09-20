import { request } from '../api'
import type { AuthTokenPair } from './types'

export const authService = {
    refresh: (refreshToken: string) => request<AuthTokenPair>('/auth/refresh', { method: 'POST', token: refreshToken }),
    me: (accessToken: string) => request<unknown>('/auth/me', { token: accessToken }),
    logout: (accessToken: string) => request<unknown>('/auth/logout', { method: 'POST', token: accessToken }),
}
