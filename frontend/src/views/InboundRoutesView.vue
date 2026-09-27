<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import CreateInboundRouteDialog from '../components/CreateInboundRouteDialog.vue'
import ResourceState from '../components/ResourceState.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { ApiError } from '../lib/api'
import { inboundRoutesService, ivrService, queuesService } from '../lib/services/configuration.service'
import { tenancyService } from '../lib/services/tenancy.service'
import type { Extension, InboundRoute, IvrMenu, Queue } from '../lib/services/types'
import { useSessionStore } from '../stores/session'

type ResourceMode = 'loading' | 'empty' | 'error' | 'forbidden' | 'ready'

const session = useSessionStore()
const routes = ref<InboundRoute[]>([])
const extensions = ref<Extension[]>([])
const queues = ref<Queue[]>([])
const ivrMenus = ref<IvrMenu[]>([])
const state = ref<ResourceMode>('loading')
const errorMessage = ref('')
const createOpen = ref(false)
const creating = ref(false)
const createError = ref('')
const pendingDelete = ref<InboundRoute | null>(null)
const token = computed(() => session.current?.token ?? '')

function extensionLabel(extension: Extension): string {
  const owner = extension.userInfo?.name || extension.callerIdName
  return owner ? `Ext ${extension.extension} — ${owner}` : `Ext ${extension.extension}`
}

function destinationLabel(route: InboundRoute): string {
  switch (route.destinationType) {
    case 'external_number':
      return route.destinationValue || '—'
    case 'hangup':
      return '—'
    case 'extension':
    case 'voicemail': {
      const extension = extensions.value.find((item) => item.id === route.destinationId)
      return extension ? extensionLabel(extension) : route.destinationId || '—'
    }
    case 'queue': {
      const queue = queues.value.find((item) => item.id === route.destinationId)
      return queue ? queue.name : route.destinationId || '—'
    }
    case 'ivr': {
      const ivr = ivrMenus.value.find((item) => item.id === route.destinationId)
      return ivr ? (ivr.name || 'Untitled IVR menu') : route.destinationId || '—'
    }
    default:
      return route.destinationValue || route.destinationId || '—'
  }
}

async function loadRoutes() {
  state.value = 'loading'
  errorMessage.value = ''
  try {
    const [nextRoutes, extensionResult, queueResult, ivrResult] = await Promise.all([
      inboundRoutesService.list(token.value),
      tenancyService.extensions(token.value).catch(() => []),
      queuesService.list(token.value).catch(() => []),
      ivrService.list(token.value).catch(() => []),
    ])
    routes.value = nextRoutes
    extensions.value = extensionResult
    queues.value = queueResult
    ivrMenus.value = ivrResult
    state.value = nextRoutes.length ? 'ready' : 'empty'
  } catch (error) {
    routes.value = []
    if (error instanceof ApiError && error.status === 403) {
      state.value = 'forbidden'
      errorMessage.value = 'You do not have access to inbound routes.'
      return
    }
    state.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : 'Inbound routes could not be loaded.'
  }
}

async function createRoute(payload: {
  sourceType: 'phone_number'
  sourceId: string
  destinationType: 'ivr' | 'queue' | 'extension' | 'voicemail' | 'external_number' | 'hangup'
  destinationId?: string
  destinationValue?: string
  enabled: boolean
}) {
  creating.value = true
  createError.value = ''
  try {
    await inboundRoutesService.create(payload, token.value)
    createOpen.value = false
    await loadRoutes()
  } catch (error) {
    createError.value = error instanceof Error ? error.message : 'Route could not be created.'
  } finally {
    creating.value = false
  }
}

async function toggleEnabled(route: InboundRoute) {
  try {
    await inboundRoutesService.update(route.id, { enabled: !route.enabled }, token.value)
    await loadRoutes()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Could not update route.'
    state.value = 'error'
  }
}

async function deleteRoute() {
  if (!pendingDelete.value) return
  try {
    await inboundRoutesService.remove(pendingDelete.value.id, token.value)
    pendingDelete.value = null
    await loadRoutes()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Could not delete route.'
    state.value = 'error'
    pendingDelete.value = null
  }
}

onMounted(loadRoutes)
</script>

<template>
  <div class="page-enter">
    <section class="page-heading">
      <div>
        <p class="eyebrow">Configuration</p>
        <h1>Inbound routes</h1>
        <p class="page-heading__copy">Route inbound numbers to hangup, IVR, extensions, or external destinations.</p>
      </div>
      <div class="heading-actions">
        <button class="button button--primary" type="button" @click="createOpen = true">
          <Plus :size="15" /> New inbound route
        </button>
      </div>
    </section>

    <ResourceState
      v-if="state === 'loading' || state === 'error' || state === 'forbidden'"
      :state="state"
      :message="errorMessage"
      :retryable="state === 'error'"
      @retry="loadRoutes"
    />

    <section v-else class="surface table-surface">
      <div class="table-scroll">
        <table v-if="state !== 'empty'">
          <thead>
            <tr>
              <th>Source</th>
              <th>Destination</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="route in routes" :key="route.id">
              <td>
                <strong>{{ route.sourceType }}</strong>
                <small>{{ route.sourceValue || route.sourceId || '—' }}</small>
              </td>
              <td>
                <strong>{{ route.destinationType }}</strong>
                <small>{{ destinationLabel(route) }}</small>
              </td>
              <td><StatusBadge :status="route.enabled ? 'active' : 'inactive'" /></td>
              <td class="table-actions">
                <button class="button button--secondary button--compact" type="button" @click="toggleEnabled(route)">
                  {{ route.enabled ? 'Disable' : 'Enable' }}
                </button>
                <button class="button button--secondary button--compact" type="button" @click="pendingDelete = route">
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <ResourceState v-if="state === 'empty'" state="empty" title="No inbound routes" message="Create a route for an inbound DID or feature code." />
      </div>
    </section>

    <CreateInboundRouteDialog
      :open="createOpen"
      :submitting="creating"
      :error="createError"
      @cancel="createOpen = false"
      @submit="createRoute"
    />
    <ConfirmDialog
      :open="Boolean(pendingDelete)"
      title="Delete inbound route?"
      message="This removes the route after the backend confirms deletion."
      confirm-label="Delete route"
      @cancel="pendingDelete = null"
      @confirm="deleteRoute"
    />
  </div>
</template>
