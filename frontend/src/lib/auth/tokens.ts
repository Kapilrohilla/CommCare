import { clearCookie, getCookie, setCookie } from './cookies'

export const COOKIE_VISITOR_TOKEN = 'cc_visitor_token'
export const COOKIE_ACCESS_TOKEN = 'cc_access_token'
export const COOKIE_REFRESH_TOKEN = 'cc_refresh_token'

export function getVisitorToken(): string | null {
  return getCookie(COOKIE_VISITOR_TOKEN)
}

export function setVisitorToken(token: string): void {
  setCookie(COOKIE_VISITOR_TOKEN, token)
}

export function getAccessToken(): string | null {
  return getCookie(COOKIE_ACCESS_TOKEN)
}

export function getRefreshToken(): string | null {
  return getCookie(COOKIE_REFRESH_TOKEN)
}

export function setSessionTokens(accessToken: string, refreshToken: string): void {
  setCookie(COOKIE_ACCESS_TOKEN, accessToken, 60 * 60)
  setCookie(COOKIE_REFRESH_TOKEN, refreshToken, 60 * 60 * 24 * 30)
}

export function clearSessionTokens(): void {
  clearCookie(COOKIE_ACCESS_TOKEN)
  clearCookie(COOKIE_REFRESH_TOKEN)
}

export function clearVisitorToken(): void {
  clearCookie(COOKIE_VISITOR_TOKEN)
}

export function clearAuthCookies(): void {
  clearSessionTokens()
  clearVisitorToken()
}
