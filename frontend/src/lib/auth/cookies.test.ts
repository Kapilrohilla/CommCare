import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearCookie, getCookie, setCookie } from './cookies'
import {
  COOKIE_ACCESS_TOKEN,
  clearSessionTokens,
  getAccessToken,
  getRefreshToken,
  setSessionTokens,
} from './tokens'

afterEach(() => {
  vi.unstubAllGlobals()
  document.cookie.split(';').forEach((part) => {
    const name = part.split('=')[0]?.trim()
    if (name) document.cookie = `${name}=; Path=/; Max-Age=0`
  })
})

describe('cookie helpers', () => {
  it('sets, reads, and clears auth cookies', () => {
    setCookie('cc_test', 'hello')
    expect(getCookie('cc_test')).toBe('hello')
    clearCookie('cc_test')
    expect(getCookie('cc_test')).toBeNull()

    setSessionTokens('access-1', 'refresh-1')
    expect(getAccessToken()).toBe('access-1')
    expect(getRefreshToken()).toBe('refresh-1')
    clearSessionTokens()
    expect(getCookie(COOKIE_ACCESS_TOKEN)).toBeNull()
  })
})
