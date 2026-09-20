import { request } from '../api'
import type { Call } from './types'

export const callsService = {
  clickToCall: (payload: { fromNumber: string; toNumber: string; type: 'internal' | 'external' }, token: string) => request<Call>('/calls/click-to-call', { method: 'POST', body: JSON.stringify(payload), token }),
  dialerSession: (payload: { startOrEnd: 'start' | 'end'; extensionId: string }, token: string) => request<unknown>('/calls/dialer/session', { method: 'POST', body: JSON.stringify(payload), token }),
}
