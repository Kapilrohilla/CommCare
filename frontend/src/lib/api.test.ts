import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, request, setAuthFailureHandler } from './api'
import { setSessionTokens, clearSessionTokens } from './auth/tokens'

afterEach(() => {
  vi.restoreAllMocks()
  setAuthFailureHandler(null)
  clearSessionTokens()
})

describe('request auth behavior', () => {
  it('unwraps the backend data envelope and attaches a bearer token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'ok', data: { id: 'trunk-1' } }), { status: 200 }),
    )
    await expect(request('/pbx/trunks/tenant', { token: 'secret-token' })).resolves.toEqual({ id: 'trunk-1' })
    const headers = fetchMock.mock.calls[0][1]?.headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer secret-token')
  })

  it('maps backend errors without exposing credentials in the thrown message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Invalid trunk', data: { password: 'should-not-render' } }), { status: 422 }),
    )
    const error = await request('/pbx/trunks', { method: 'POST', body: JSON.stringify({ password: 'secret' }) }).catch((caught) => caught)
    expect(error).toBeInstanceOf(ApiError)
    if (!(error instanceof ApiError)) throw error
    expect(error.status).toBe(422)
    expect(error.message).toBe('Invalid trunk')
    expect(error.message).not.toContain('secret')
  })

  it('maps unreachable APIs to a safe network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('socket details'))
    await expect(request('/health')).rejects.toMatchObject({ message: 'The CommCare API could not be reached.', status: 0 })
  })

  it('refreshes access token once on 401 and retries', async () => {
    setSessionTokens('old-access', 'refresh-token')
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'expired' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { accessToken: 'new-access' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }))

    await expect(request('/calls/dashboard', { auth: 'access', token: 'old-access' })).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const retryHeaders = fetchMock.mock.calls[2][1]?.headers as Headers
    expect(retryHeaders.get('Authorization')).toBe('Bearer new-access')
  })

  it('clears session and invokes auth failure handler when refresh fails', async () => {
    setSessionTokens('old-access', 'refresh-token')
    const onFail = vi.fn()
    setAuthFailureHandler(onFail)
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'expired' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'refresh expired' }), { status: 401 }))

    await expect(request('/calls/dashboard', { auth: 'access', token: 'old-access' })).rejects.toBeInstanceOf(ApiError)
    expect(onFail).toHaveBeenCalled()
  })
})
