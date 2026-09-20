<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import CreateWebhookDialog from '../components/CreateWebhookDialog.vue'
import ResourceState from '../components/ResourceState.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { ApiError } from '../lib/api'
import { webhooksService } from '../lib/services/integrations.service'
import type { Webhook } from '../lib/services/types'
import { useSessionStore } from '../stores/session'

type ResourceMode = 'loading' | 'empty' | 'error' | 'forbidden' | 'ready'

const session = useSessionStore()
const webhooks = ref<Webhook[]>([])
const state = ref<ResourceMode>('loading')
const errorMessage = ref('')
const createOpen = ref(false)
const creating = ref(false)
const createError = ref('')
const token = computed(() => session.current?.token ?? '')

async function loadWebhooks() {
  state.value = 'loading'
  errorMessage.value = ''
  try {
    webhooks.value = await webhooksService.list(token.value)
    state.value = webhooks.value.length ? 'ready' : 'empty'
  } catch (error) {
    webhooks.value = []
    if (error instanceof ApiError && error.status === 403) {
      state.value = 'forbidden'
      errorMessage.value = 'You do not have access to webhooks.'
      return
    }
    state.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : 'Webhooks could not be loaded.'
  }
}

async function createWebhook(payload: {
  name: string
  description?: string
  endpoint: string
  method: string
  triggerEvent: string
}) {
  creating.value = true
  createError.value = ''
  try {
    await webhooksService.create(payload, token.value)
    createOpen.value = false
    await loadWebhooks()
  } catch (error) {
    createError.value = error instanceof Error ? error.message : 'Webhook could not be created.'
  } finally {
    creating.value = false
  }
}

onMounted(loadWebhooks)
</script>

<template>
  <div class="page-enter">
    <section class="page-heading">
      <div>
        <p class="eyebrow">Integrations</p>
        <h1>Webhooks</h1>
        <p class="page-heading__copy">Configure outbound event delivery without exposing signing secrets.</p>
      </div>
      <div class="heading-actions">
        <button class="button button--primary" type="button" @click="createOpen = true">
          <Plus :size="15" /> New webhook
        </button>
      </div>
    </section>

    <ResourceState
      v-if="state === 'loading' || state === 'error' || state === 'forbidden'"
      :state="state"
      :message="errorMessage"
      :retryable="state === 'error'"
      @retry="loadWebhooks"
    />

    <section v-else class="surface table-surface">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Event</th>
              <th>Endpoint</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="hook in webhooks" :key="hook.id">
              <td><strong>{{ hook.name }}</strong></td>
              <td>{{ hook.event || (hook as { triggerEvent?: string }).triggerEvent || '—' }}</td>
              <td>{{ hook.url || (hook as { endpoint?: string }).endpoint || '—' }}</td>
              <td><StatusBadge :status="hook.enabled === false ? 'inactive' : 'active'" /></td>
            </tr>
          </tbody>
        </table>
        <ResourceState v-if="state === 'empty'" state="empty" title="No webhooks" message="Create a webhook to receive call lifecycle events." />
      </div>
    </section>

    <CreateWebhookDialog
      :open="createOpen"
      :submitting="creating"
      :error="createError"
      @cancel="createOpen = false"
      @submit="createWebhook"
    />
  </div>
</template>
