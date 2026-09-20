import { request } from '../api'
import type { Call, CallListQuery, CallListResponse, DashboardMetrics } from './types'

function toQuery(query: CallListQuery = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const callsService = {
  list: (query: CallListQuery, token: string) =>
    request<CallListResponse>(`/calls/tenant${toQuery(query)}`, { token }),
  get: (id: string, token: string) => request<Call>(`/calls/${id}`, { token }),
  dashboard: (token: string) => request<DashboardMetrics>('/calls/dashboard', { token }),
  clickToCall: (payload: { fromNumber: string; toNumber: string; type: 'internal' | 'external' }, token: string) =>
    request<Call>('/calls/click-to-call', { method: 'POST', body: JSON.stringify(payload), token }),
  dialerSession: (payload: { startOrEnd: 'start' | 'end'; extensionId: string }, token: string) =>
    request<unknown>('/calls/dialer/session', { method: 'POST', body: JSON.stringify(payload), token }),
}
