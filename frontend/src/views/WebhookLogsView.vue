<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import ResourceState from '../components/ResourceState.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { ApiError } from '../lib/api'
import { webhookLogsService, webhooksService } from '../lib/services/integrations.service'
import type { Webhook, WebhookLog } from '../lib/services/types'
import { useSessionStore } from '../stores/session'

type ResourceMode = 'loading' | 'empty' | 'error' | 'forbidden' | 'ready'

function defaultFrom() {
  const date = new Date()
  date.setDate(date.getDate() - 7)
  date.setSeconds(0, 0)
  return toLocalInput(date)
}

function defaultTo() {
  const date = new Date()
  date.setSeconds(0, 0)
  return toLocalInput(date)
}

function toLocalInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toIso(localValue: string) {
  if (!localValue) return undefined
  const date = new Date(localValue)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function deliveryStatus(log: WebhookLog) {
  const code = log.responseStatusCode ?? log.responseStatus ?? 0
  if (code >= 200 && code < 300) return 'delivered'
  if (code >= 400) return 'failed'
  return 'pending'
}

function formatWhen(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const session = useSessionStore()
const logs = ref<WebhookLog[]>([])
const webhooks = ref<Webhook[]>([])
const state = ref<ResourceMode>('loading')
const errorMessage = ref('')
const from = ref(defaultFrom())
const to = ref(defaultTo())
const token = computed(() => session.current?.token ?? '')

const webhookNameById = computed(() => {
  const map = new Map<string, string>()
  for (const hook of webhooks.value) map.set(hook.id, hook.name)
  return map
})

function webhookLabel(log: WebhookLog) {
  return webhookNameById.value.get(log.webhookRegistryId) || log.webhookRegistryId.slice(0, 8)
}

function eventLabel(log: WebhookLog) {
  if (log.event) return log.event
  const payload = log.requestPayload as { event?: string; triggerEvent?: string } | undefined
  return payload?.event || payload?.triggerEvent || '—'
}

async function loadLogs() {
  state.value = 'loading'
  errorMessage.value = ''
  try {
    const [logRows, hookRows] = await Promise.all([
      webhookLogsService.list(token.value, {
        from: toIso(from.value),
        to: toIso(to.value),
      }),
      webhooksService.list(token.value).catch(() => [] as Webhook[]),
    ])
    logs.value = logRows
    webhooks.value = hookRows
    state.value = logRows.length ? 'ready' : 'empty'
  } catch (error) {
    logs.value = []
    if (error instanceof ApiError && error.status === 403) {
      state.value = 'forbidden'
      errorMessage.value = 'You do not have access to delivery logs.'
      return
    }
    state.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : 'Delivery logs could not be loaded.'
  }
}

onMounted(loadLogs)
watch([from, to], loadLogs)
</script>

<template>
  <div class="page-enter">
    <section class="page-heading">
      <div>
        <p class="eyebrow">Integrations</p>
        <h1>Delivery logs</h1>
        <p class="page-heading__copy">
          Investigate webhook delivery status, response metadata, retries, and sanitized payloads.
        </p>
      </div>
      <div class="heading-actions">
        <button class="button button--secondary" type="button" @click="loadLogs">
          <RefreshCw :size="15" /> Refresh
        </button>
      </div>
    </section>

    <section class="surface table-surface">
      <div class="surface__header table-header logs-header">
        <div>
          <span class="overline">Tenant scoped</span>
          <h2>Delivery activity</h2>
        </div>
        <div class="logs-range" aria-label="Delivery datetime range">
          <label>
            From
            <input v-model="from" type="datetime-local" />
          </label>
          <label>
            To
            <input v-model="to" type="datetime-local" />
          </label>
        </div>
      </div>

      <ResourceState
        v-if="state === 'loading' || state === 'error' || state === 'forbidden'"
        :state="state"
        :message="errorMessage"
        :retryable="state === 'error'"
        @retry="loadLogs"
      />

      <div v-else class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Webhook</th>
              <th>Endpoint</th>
              <th>Event</th>
              <th>Response</th>
              <th>Status</th>
              <th>Delivered</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in logs" :key="log.id">
              <td><strong>{{ webhookLabel(log) }}</strong></td>
              <td>
                <span class="logs-endpoint">
                  <small>{{ log.requestMethod?.toUpperCase() }}</small>
                  {{ log.requestEndpoint }}
                </span>
              </td>
              <td>{{ eventLabel(log) }}</td>
              <td>{{ log.responseStatusCode ?? log.responseStatus ?? '—' }}</td>
              <td><StatusBadge :status="deliveryStatus(log)" /></td>
              <td>{{ formatWhen(log.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
        <ResourceState
          v-if="state === 'empty'"
          state="empty"
          title="No deliveries in range"
          message="Adjust the datetime range or wait for the next webhook delivery."
        />
      </div>
    </section>
  </div>
</template>
