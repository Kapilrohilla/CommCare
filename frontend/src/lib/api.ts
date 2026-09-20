export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://3.109.68.132:3000'

export class ApiError extends Error {
  status: number
  details: unknown
  constructor(message: string, status = 0, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export type AuthMode = 'none' | 'visitor' | 'access'

type RequestOptions = RequestInit & {
  token?: string
  auth?: AuthMode
  _retried?: boolean
  _visitorRetried?: boolean
}

let refreshPromise: Promise<string | null> | null = null
let onAuthFailure: (() => void) | null = null

export function setAuthFailureHandler(handler: (() => void) | null) {
  onAuthFailure = handler
}

async function parsePayload(response: Response) {
  return response.json().catch(() => null)
}

async function refreshAccessToken(): Promise<string | null> {
  const { getRefreshToken, setSessionTokens, clearSessionTokens } = await import('./auth/tokens')
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/auth/refresh`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${refreshToken}`,
    },
  })
  const payload = await parsePayload(response)
  if (!response.ok) {
    clearSessionTokens()
    return null
  }
  const data = (payload?.data ?? payload) as { accessToken?: string; refreshToken?: string }
  if (!data?.accessToken) {
    clearSessionTokens()
    return null
  }
  const nextRefresh = data.refreshToken ?? refreshToken
  setSessionTokens(data.accessToken, nextRefresh)
  return data.accessToken
}

function singleFlightRefresh() {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

async function resolveToken(options: RequestOptions): Promise<string | undefined> {
  if (options.token) return options.token
  const mode = options.auth ?? 'none'
  if (mode === 'visitor') {
    const { ensureVisitorToken } = await import('./auth/visitor-bootstrap')
    return ensureVisitorToken()
  }
  if (mode === 'access') {
    const { getAccessToken } = await import('./auth/tokens')
    return getAccessToken() ?? undefined
  }
  return undefined
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token: _tokenOpt, auth = 'none', _retried, _visitorRetried, ...init } = options
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const bearer = await resolveToken(options)
  if (bearer) headers.set('Authorization', `Bearer ${bearer}`)

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}${path}`, { ...init, headers })
  } catch {
    throw new ApiError('The CommCare API could not be reached.')
  }

  const payload = await parsePayload(response)

  if (response.status === 401 && auth === 'visitor' && !_visitorRetried) {
    const { ensureVisitorToken } = await import('./auth/visitor-bootstrap')
    await ensureVisitorToken(true)
    return request<T>(path, { ...options, auth: 'visitor', _visitorRetried: true })
  }

  if (response.status === 401 && auth !== 'visitor' && !_retried) {
    const nextAccess = await singleFlightRefresh()
    if (nextAccess) {
      return request<T>(path, { ...options, auth: auth === 'access' ? 'access' : auth, token: nextAccess, _retried: true })
    }
    if (auth === 'access' || options.token) {
      onAuthFailure?.()
      throw new ApiError('Your session has expired. Please sign in again.', 401, payload)
    }
  }

  if (!response.ok) {
    const message = typeof payload?.message === 'string' ? payload.message : 'The request could not be completed.'
    throw new ApiError(message, response.status, payload)
  }

  return (payload?.data ?? payload) as T
}
