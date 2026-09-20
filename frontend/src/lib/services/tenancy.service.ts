import { request } from '../api'
import type { Extension } from './types'

export const tenancyService = {
  extensions: (token: string) => request<Extension[]>('/tenancy/extension/', { token }),
  myExtensions: (token: string) => request<Extension[]>('/tenancy/extension/me', { token }),
  bulkRegister: (count: number, token: string) => request<unknown>('/tenancy/extension/bulk-register', { method: 'POST', body: JSON.stringify({ count }), token }),
  assign: (payload: { userId: string; extensionIds: string[] }, token: string) => request<Extension[]>('/tenancy/extension/assign', { method: 'POST', body: JSON.stringify(payload), token }),
  unassign: (extensionId: string, token: string) => request<Extension>('/tenancy/extension/unassign', { method: 'POST', body: JSON.stringify({ extensionId }), token }),
  unregister: (extensionId: string, token: string) => request<Extension>('/tenancy/extension/unregister', { method: 'POST', body: JSON.stringify({ extensionId }), token }),
}
