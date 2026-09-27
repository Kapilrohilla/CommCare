import { request } from '../api'
import type { InboundRoute, IvrMenu, IvrOption, PhoneNumber, Queue, QueueMember, SipTrunk } from './types'

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

export const ivrOptionsService = {
    list: (ivrId: string, token: string) => request<IvrOption[]>(`/ivr/${ivrId}/options`, { token }),
    create: (ivrId: string, payload: Partial<IvrOption>, token: string) =>
        request<IvrOption>(`/ivr/${ivrId}/options`, { method: 'POST', body: JSON.stringify(payload), token }),
    update: (ivrId: string, optionId: string, payload: Partial<IvrOption>, token: string) =>
        request<IvrOption>(`/ivr/${ivrId}/options/${optionId}`, { method: 'PATCH', body: JSON.stringify(payload), token }),
    remove: (ivrId: string, optionId: string, token: string) =>
        request(`/ivr/${ivrId}/options/${optionId}`, { method: 'DELETE', token }),
}

export const phoneNumbersService = {
    list: (token: string, query?: { sipTrunkId?: string; status?: string; search?: string }) => {
        const params = new URLSearchParams()
        if (query?.sipTrunkId) params.set('sipTrunkId', query.sipTrunkId)
        if (query?.status) params.set('status', query.status)
        if (query?.search) params.set('search', query.search)
        const qs = params.toString()
        return request<PhoneNumber[]>(`/phone-numbers${qs ? `?${qs}` : ''}`, { token })
    },
    get: (id: string, token: string) => request<PhoneNumber>(`/phone-numbers/${id}`, { token }),
    create: (payload: Partial<PhoneNumber>, token: string) =>
        request<PhoneNumber>('/phone-numbers', { method: 'POST', body: JSON.stringify(payload), token }),
    update: (id: string, payload: Partial<PhoneNumber>, token: string) =>
        request<PhoneNumber>(`/phone-numbers/${id}`, { method: 'PATCH', body: JSON.stringify(payload), token }),
    remove: (id: string, token: string) => request(`/phone-numbers/${id}`, { method: 'DELETE', token }),
}

export const queuesService = {
    list: (token: string) => request<Queue[]>('/queues', { token }),
    get: (id: string, token: string) => request<Queue>(`/queues/${id}`, { token }),
    create: (payload: Partial<Queue>, token: string) =>
        request<Queue>('/queues', { method: 'POST', body: JSON.stringify(payload), token }),
    update: (id: string, payload: Partial<Queue>, token: string) =>
        request<Queue>(`/queues/${id}`, { method: 'PATCH', body: JSON.stringify(payload), token }),
    remove: (id: string, token: string) => request(`/queues/${id}`, { method: 'DELETE', token }),
}

export const queueMembersService = {
    list: (queueId: string, token: string) => request<QueueMember[]>(`/queues/${queueId}/members`, { token }),
    add: (queueId: string, payload: { agentId: string; priority?: number; penalty?: number; enabled?: boolean }, token: string) =>
        request<QueueMember>(`/queues/${queueId}/members`, { method: 'POST', body: JSON.stringify(payload), token }),
    remove: (queueId: string, agentId: string, token: string) =>
        request(`/queues/${queueId}/members/${agentId}`, { method: 'DELETE', token }),
}

export const trunksService = {
    list: (token: string) => request<SipTrunk[]>('/pbx/trunks/tenant', { token }),
    get: (id: string, token: string) => request<SipTrunk>(`/pbx/trunks/${id}`, { token }),
    create: (payload: {
        name: string
        authMode: 'ip' | 'credentials'
        username?: string
        password?: string
        identifyIps?: string[]
        enabled?: boolean
    }, token: string) => request<SipTrunk>('/pbx/trunks', { method: 'POST', body: JSON.stringify(payload), token }),
    update: (id: string, payload: Partial<SipTrunk> & { password?: string; identifyIps?: string[] }, token: string) => request<SipTrunk>(`/pbx/trunks/${id}`, { method: 'PATCH', body: JSON.stringify(payload), token }),
    remove: (id: string, token: string) => request(`/pbx/trunks/${id}`, { method: 'DELETE', token }),
    sync: (id: string, token: string) => request<SipTrunk>(`/pbx/trunks/${id}/sync-asterisk`, { method: 'POST', token }),
}
