<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Pause, Play, Plus, RefreshCw, Trash2 } from 'lucide-vue-next'
import ConfirmDialog from '../components/ConfirmDialog.vue'
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

function webhookStatus(hook: Webhook) {
  if (hook.enabled === false) return 'inactive'
  if (hook.status) return hook.status
  return 'active'
}

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

const actionError = ref('')
const pendingId = ref<string | null>(null)
const deleteTarget = ref<Webhook | null>(null)

async function runAction(hook: Webhook, action: () => Promise<unknown>, fallback: string) {
  if (pendingId.value) return
  pendingId.value = hook.id
  actionError.value = ''
  try {
    await action()
    await loadWebhooks()
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : fallback
  } finally {
    pendingId.value = null
  }
}

function toggleWebhook(hook: Webhook) {
  const isActive = webhookStatus(hook) === 'active'
  return runAction(
    hook,
    () => (isActive ? webhooksService.disable(hook.id, token.value) : webhooksService.enable(hook.id, token.value)),
    isActive ? 'Webhook could not be disabled.' : 'Webhook could not be enabled.',
  )
}

async function confirmDelete() {
  const hook = deleteTarget.value
  if (!hook) return
  deleteTarget.value = null
  await runAction(hook, () => webhooksService.remove(hook.id, token.value), 'Webhook could not be deleted.')
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
        <button class="button button--secondary" type="button" @click="loadWebhooks">
          <RefreshCw :size="15" /> Refresh
        </button>
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
      <p v-if="actionError" class="webhook-actions-error" role="alert">{{ actionError }}</p>
      <div class="table-scroll">
        <table v-if="state !== 'empty'">
          <thead>
            <tr>
              <th>Name</th>
              <th>Event</th>
              <th>Endpoint</th>
              <th>Method</th>
              <th>Status</th>
              <th class="table-actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="hook in webhooks" :key="hook.id">
              <td>
                <strong>{{ hook.name }}</strong>
                <small v-if="hook.description" class="table-sub">{{ hook.description }}</small>
              </td>
              <td>{{ hook.triggerEvent || hook.event || '—' }}</td>
              <td>{{ hook.endpoint || hook.url || '—' }}</td>
              <td>{{ (hook.method || 'post').toUpperCase() }}</td>
              <td><StatusBadge :status="webhookStatus(hook)" /></td>
              <td class="table-actions-col webhook-actions-cell">
                <button
                  class="button button--secondary"
                  type="button"
                  data-testid="toggle-webhook"
                  :disabled="pendingId !== null || webhookStatus(hook) === 'blocked'"
                  :title="webhookStatus(hook) === 'blocked' ? 'Blocked webhooks cannot be changed' : undefined"
                  @click="toggleWebhook(hook)"
                >
                  <Pause v-if="webhookStatus(hook) === 'active'" :size="14" />
                  <Play v-else :size="14" />
                  {{ webhookStatus(hook) === 'active' ? 'Disable' : 'Enable' }}
                </button>
                <button
                  class="icon-button"
                  type="button"
                  aria-label="Delete"
                  title="Delete"
                  :disabled="pendingId !== null"
                  @click="deleteTarget = hook"
                >
                  <Trash2 :size="15" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <ResourceState
          v-if="state === 'empty'"
          state="empty"
          title="No webhooks"
          message="Create a webhook to receive call lifecycle events."
        />
      </div>
    </section>

    <ConfirmDialog
      :open="deleteTarget !== null"
      title="Delete webhook"
      :message="`Delete ${deleteTarget?.name ?? 'this webhook'}? This cannot be undone.`"
      confirm-label="Delete"
      @cancel="deleteTarget = null"
      @confirm="confirmDelete"
    />

    <CreateWebhookDialog
      :open="createOpen"
      :submitting="creating"
      :error="createError"
      @cancel="createOpen = false"
      @submit="createWebhook"
    />
  </div>
</template>
