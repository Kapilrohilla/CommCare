export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://3.109.68.132:3000'

export class ApiError extends Error {
    status: number
    details: unknown
    constructor(message: string, status = 0, details?: unknown) { super(message); this.name = 'ApiError'; this.status = status; this.details = details }
}

type RequestOptions = RequestInit & { token?: string }
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { token, ...init } = options
    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    if (token) headers.set('Authorization', `Bearer ${token}`)
    let response: Response
    try { response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}${path}`, { ...init, headers }) } catch { throw new ApiError('The CommCare API could not be reached.') }
    const payload = await response.json().catch(() => null)
    if (!response.ok) { const message = typeof payload?.message === 'string' ? payload.message : 'The request could not be completed.'; throw new ApiError(message, response.status, payload) }
    return (payload?.data ?? payload) as T
}
