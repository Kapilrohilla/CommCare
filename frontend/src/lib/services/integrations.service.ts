import { request } from '../api'
import type { Recording, Webhook, WebhookLog } from './types'

export type SystemRecording = Recording & {
  description?: string | null
  sourceType?: 'upload' | 'tts' | null
  status: string
  errorMessage?: string | null
  ttsText?: string | null
  mimeType?: string | null
  duration?: number | null
}

export const recordingsService = {
  list: (token: string) => request<SystemRecording[]>('/system-recordings/tenant', { token }),
  get: (id: string, token: string) => request<SystemRecording>(`/system-recordings/${id}`, { token }),
  create: (payload: { name: string; description?: string }, token: string) =>
    request<SystemRecording>('/system-recordings', { method: 'POST', body: JSON.stringify(payload), token }),
  update: (
    id: string,
    payload: { name?: string; description?: string; sourceType?: 'upload' | 'tts'; ttsText?: string; ttsVoice?: string; ttsLanguage?: string },
    token: string,
  ) => request<SystemRecording>(`/system-recordings/${id}`, { method: 'PATCH', body: JSON.stringify(payload), token }),
  uploadUrl: (id: string, fileName: string, token: string) =>
    request<{ url: string }>(`/system-recordings/${id}/upload-url`, {
      method: 'POST',
      body: JSON.stringify({ fileName }),
      token,
    }),
  confirmUpload: (id: string, fileName: string, token: string) =>
    request<SystemRecording>(`/system-recordings/${id}/upload/confirm`, {
      method: 'POST',
      body: JSON.stringify({ fileName }),
      token,
    }),
  process: (id: string, token: string) =>
    request<SystemRecording>(`/system-recordings/${id}/process`, { method: 'POST', token }),
  remove: (id: string, token: string) => request(`/system-recordings/${id}`, { method: 'DELETE', token }),
}

export const webhooksService = {
  list: (token: string) => request<Webhook[]>('/webhook-registry/tenant', { token }),
  create: (
    payload: { name: string; description?: string; endpoint: string; method: string; triggerEvent: string },
    token: string,
  ) => request<Webhook>('/webhook-registry', { method: 'POST', body: JSON.stringify(payload), token }),
}

export type WebhookLogQuery = {
  from?: string
  to?: string
}

export const webhookLogsService = {
  list: (token: string, query: WebhookLogQuery = {}) => {
    const params = new URLSearchParams()
    if (query.from) params.set('from', query.from)
    if (query.to) params.set('to', query.to)
    const qs = params.toString()
    return request<WebhookLog[]>(`/webhook-logs/tenant${qs ? `?${qs}` : ''}`, { token })
  },
}

export const healthService = {
  status: (token: string) => request<unknown>('/healthCheck/health', { token }),
}
