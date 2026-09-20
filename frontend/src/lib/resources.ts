import { request } from './api'

export type ResourceId = string
export type ResourceClient<T> = {
    list: (path: string, token?: string) => Promise<T[]>
    get: (path: string, token?: string) => Promise<T>
    create: (path: string, payload: Partial<T>, token?: string) => Promise<T>
    update: (path: string, payload: Partial<T>, token?: string) => Promise<T>
    remove: (path: string, token?: string) => Promise<void>
}

export function createResourceClient<T>(): ResourceClient<T> {
    return {
        list: (path, token) => request<T[]>(path, { token }),
        get: (path, token) => request<T>(path, { token }),
        create: (path, payload, token) => request<T>(path, { method: 'POST', body: JSON.stringify(payload), token }),
        update: (path, payload, token) => request<T>(path, { method: 'PATCH', body: JSON.stringify(payload), token }),
        remove: async (path, token) => { await request(path, { method: 'DELETE', token }) },
    }
}
