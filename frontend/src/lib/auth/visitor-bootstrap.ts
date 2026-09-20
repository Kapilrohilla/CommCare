import { ApiError, API_BASE_URL } from '../api'
import { getOrCreateVisitorId } from './visitor'
import { getVisitorToken, setVisitorToken } from './tokens'

type VisitorBootstrap = {
  visitorId: string
  visitorToken: string
}

let bootstrapPromise: Promise<string> | null = null

async function createVisitorToken(): Promise<string> {
  const visitorId = getOrCreateVisitorId()
  const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/auth/visitor`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      identifier: visitorId,
      identifierType: 'uuid',
      appType: 'portal',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      metadata: {},
    }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message = typeof payload?.message === 'string' ? payload.message : 'Could not create visitor session.'
    throw new ApiError(message, response.status, payload)
  }

  const data = (payload?.data ?? payload) as VisitorBootstrap
  if (!data?.visitorToken) throw new ApiError('Visitor token missing from response.')
  setVisitorToken(data.visitorToken)
  return data.visitorToken
}

export async function ensureVisitorToken(force = false): Promise<string> {
  if (!force) {
    const existing = getVisitorToken()
    if (existing) return existing
  }

  if (!bootstrapPromise) {
    bootstrapPromise = createVisitorToken().finally(() => {
      bootstrapPromise = null
    })
  }
  return bootstrapPromise
}
