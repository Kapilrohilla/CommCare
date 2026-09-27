export type AuthTokenPair = { accessToken: string; refreshToken?: string }
export type Extension = { id: string; extension: string; status: string; type?: string; callerIdName?: string | null; userId?: string | null; userInfo?: { name?: string } | null }
export type TenantUser = {
  id: string
  name: string
  tenantId?: string | null
  status: 'active' | 'inactive' | string
  createdAt?: string
  extensions?: Array<{ id: string; extension: string; status: string }>
}
export type InboundRoute = {
  id: string
  sourceType: string
  sourceId?: string | null
  sourceValue?: string | null
  destinationType: string
  destinationId?: string | null
  destinationValue?: string | null
  enabled: boolean
}
export type IvrInvalidKeyAction = 'replay_announcement' | 'route_to_final_timeout' | 'hangup'
export type IvrOptionDestinationType = 'PhoneNumber' | 'IVR' | 'Extension' | 'IB_Queue' | 'hangup' | 'Announcement'
export type IvrMenu = {
  id: string
  name: string
  description?: string | null
  announcementRecordingId?: string | null
  enabled: boolean
  inputTimeoutSeconds: number
  maxInvalidRetries: number
  invalidKeyAction: IvrInvalidKeyAction
  finalTimeoutDestinationType: IvrOptionDestinationType
  finalTimeoutDestinationId?: string | null
  finalTimeoutDestinationValue?: string | null
  createdAt?: string
  updatedAt?: string
}
export type IvrOption = {
  id: string
  ivrId: string
  digit: string
  destinationType: IvrOptionDestinationType
  destinationId?: string | null
  destinationValue?: string | null
  label?: string | null
  createdAt?: string
  updatedAt?: string
}
export type PhoneNumberType = 'did'
export type PhoneNumberStatusValue = 'active' | 'inactive'
export type PhoneNumber = {
  id: string
  tenantId: string
  sipTrunkId: string
  number: string
  type: PhoneNumberType
  status: PhoneNumberStatusValue
  name: string
  description?: string | null
  createdAt?: string
  updatedAt?: string
}
export type QueueStrategy = 'ring_all' | 'round_robin' | 'least_recent' | 'fewest_calls' | 'random'
export type Queue = {
  id: string
  tenantId?: string
  name: string
  description?: string | null
  strategy: QueueStrategy
  ringTimeoutSeconds: number
  maxWaitTimeSeconds: number
  maxCallers?: number | null
  musicOnHoldId?: string | null
  enabled: boolean
  createdAt?: string
  updatedAt?: string
}
export type QueueMember = {
  id: string
  queueId: string
  agentId: string
  priority: number
  penalty: number
  enabled: boolean
  createdAt?: string
  updatedAt?: string
}
export type SipTrunk = { id: string; name: string; authMode: string; username?: string | null; enabled: boolean; identifyIps?: { id?: string; match: string }[] }
export type CallDirection = 'inbound' | 'outbound' | 'internal'
export type CallStatus =
  | 'initiated'
  | 'originating'
  | 'ringing'
  | 'answered'
  | 'completed'
  | 'no_answer'
  | 'busy'
  | 'failed'
  | 'cancelled'
  | 'unavailable'
  | 'rejected'
export type CallWorkflow = 'click_to_call'
export type Call = {
  id: string
  status: CallStatus | string
  direction?: CallDirection | string
  workflow?: CallWorkflow | string
  callerNumber?: string | null
  callToNumber?: string | null
  fromNumber?: string
  toNumber?: string
  agentExtension?: string | null
  startedAt?: string | null
  endedAt?: string | null
  duration?: number
  recordingAvailable?: boolean
  recordingUrl?: string | null
}
export type CallListQuery = {
  from?: string
  to?: string
  direction?: CallDirection
  workflow?: CallWorkflow
  status?: CallStatus
  agentExtension?: string
  number?: string
  limit?: number
  offset?: number
}
export type CallListResponse = { items: Call[]; total: number }
export type DashboardMetrics = {
  callsToday: { total: number; byStatus: Partial<Record<string, number>> }
  talkTimeSeconds: number
  missedCalls: number
  extensions: { assigned: number; total: number } | null
  recentCalls: Call[]
  asOf: string
}
export type Webhook = {
  id: string
  name: string
  description?: string | null
  url?: string
  endpoint?: string
  enabled?: boolean
  status?: string
  event?: string
  triggerEvent?: string
  method?: string
}
export type Recording = {
  id: string
  name?: string
  status: string
  url?: string | null
  duration?: number | null
  sourceType?: string | null
  errorMessage?: string | null
}
export type WebhookLog = {
  id: string
  webhookRegistryId: string
  tenantId: string
  requestEndpoint: string
  requestMethod: string
  requestPayload?: Record<string, unknown>
  requestHeaders?: Record<string, unknown>
  responsePayload?: Record<string, unknown>
  responseStatusCode: number
  createdAt: string
  status?: string
  event?: string
  responseStatus?: number | null
}
