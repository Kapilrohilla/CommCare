import { request } from '../api'
import type { Recording, Webhook, WebhookLog } from './types'

export const recordingsService = { list: (token: string) => request<Recording[]>('/system-recordings/tenant', { token }) }
export const webhooksService = { list: (token: string) => request<Webhook[]>('/webhook-registry/tenant', { token }) }
export const webhookLogsService = { list: (token: string) => request<WebhookLog[]>('/webhook-logs/tenant', { token }) }
export const healthService = { status: (token: string) => request<unknown>('/healthCheck', { token }) }
