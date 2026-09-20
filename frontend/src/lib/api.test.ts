import { describe, expect, it, vi, afterEach } from 'vitest'
import { ApiError, request } from './api'

afterEach(() => vi.restoreAllMocks())

describe('request', () => {
    it('unwraps the backend data envelope and attaches a bearer token', async () => {
        const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ message: 'ok', data: { id: 'trunk-1' } }), { status: 200 }))
        await expect(request('/pbx/trunks/tenant', { token: 'secret-token' })).resolves.toEqual({ id: 'trunk-1' })
        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/pbx/trunks/tenant'), expect.objectContaining({ headers: expect.any(Headers) }))
        const headers = fetchMock.mock.calls[0][1]?.headers as Headers
        expect(headers.get('Authorization')).toBe('Bearer secret-token')
    })

    it('maps backend errors without exposing credentials in the thrown message', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ message: 'Invalid trunk', data: { password: 'should-not-render' } }), { status: 422 }))
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
})
