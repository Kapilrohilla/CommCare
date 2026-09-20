import { request } from '../api'
import type { InboundRoute, IvrMenu, SipTrunk } from './types'

export const inboundRoutesService = {
  list: (token: string) => request<InboundRoute[]>('/inbound-routes/tenant', { token }),
  get: (id: string, token: string) => request<InboundRoute>(`/inbound-routes/${id}`, { token }),
  create: (payload: Partial<InboundRoute>, token: string) => request<InboundRoute>('/inbound-routes', { method: 'POST', body: JSON.stringify(payload), token }),
  update: (id: string, payload: Partial<InboundRoute>, token: string) => request<InboundRoute>(`/inbound-routes/${id}`, { method: 'PATCH', body: JSON.stringify(payload), token }),
  remove: (id: string, token: string) => request(`/inbound-routes/${id}`, { method: 'DELETE', token }),
}

export const ivrService = {
  list: (token: string) => request<IvrMenu[]>('/ivr/tenant', { token }),
  get: (id: string, token: string) => request<IvrMenu>(`/ivr/${id}`, { token }),
  create: (payload: Partial<IvrMenu>, token: string) => request<IvrMenu>('/ivr', { method: 'POST', body: JSON.stringify(payload), token }),
  update: (id: string, payload: Partial<IvrMenu>, token: string) => request<IvrMenu>(`/ivr/${id}`, { method: 'PATCH', body: JSON.stringify(payload), token }),
  remove: (id: string, token: string) => request(`/ivr/${id}`, { method: 'DELETE', token }),
}

export const trunksService = {
  list: (token: string) => request<SipTrunk[]>('/pbx/trunks/tenant', { token }),
  get: (id: string, token: string) => request<SipTrunk>(`/pbx/trunks/${id}`, { token }),
  create: (payload: Partial<SipTrunk>, token: string) => request<SipTrunk>('/pbx/trunks', { method: 'POST', body: JSON.stringify(payload), token }),
  update: (id: string, payload: Partial<SipTrunk>, token: string) => request<SipTrunk>(`/pbx/trunks/${id}`, { method: 'PATCH', body: JSON.stringify(payload), token }),
  remove: (id: string, token: string) => request(`/pbx/trunks/${id}`, { method: 'DELETE', token }),
  sync: (id: string, token: string) => request<SipTrunk>(`/pbx/trunks/${id}/sync-asterisk`, { method: 'POST', token }),
}
