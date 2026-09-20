import { request } from '../api'
import type { Extension, TenantUser } from './types'

export const tenancyService = {
  extensions: (token: string) => request<Extension[]>('/tenancy/extension/', { token }),
  myExtensions: (token: string) => request<Extension[]>('/tenancy/extension/me', { token }),
  users: (token: string) => request<TenantUser[]>('/tenancy/extension/users', { token }),
  createUser: (payload: { name: string; extensionIds: string[] }, token: string) =>
    request<{ user: TenantUser; extensions: Extension[] }>('/tenancy/extension/users', {
      method: 'POST',
      body: JSON.stringify(payload),
      token,
    }),
  updateUser: (userId: string, payload: { name?: string; status?: 'active' | 'inactive' }, token: string) =>
    request<{ user: TenantUser }>(`/tenancy/extension/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
      token,
    }),
  deleteUser: (userId: string, token: string) =>
    request<{ id: string }>(`/tenancy/extension/users/${userId}`, { method: 'DELETE', token }),
  bulkRegister: (count: number, token: string) =>
    request<unknown>('/tenancy/extension/bulk-register', {
      method: 'POST',
      body: JSON.stringify({ count }),
      token,
    }),
  assign: (payload: { userId: string; extensionIds: string[] }, token: string) =>
    request<{ user: { id: string; name: string }; extensions: Extension[] }>('/tenancy/extension/assign', {
      method: 'POST',
      body: JSON.stringify(payload),
      token,
    }),
  unassign: (extensionId: string, token: string) =>
    request<Extension>('/tenancy/extension/unassign', {
      method: 'POST',
      body: JSON.stringify({ extensionId }),
      token,
    }),
  unregister: (extensionId: string, token: string) =>
    request<Extension>('/tenancy/extension/unregister', {
      method: 'POST',
      body: JSON.stringify({ extensionId }),
      token,
    }),
}
