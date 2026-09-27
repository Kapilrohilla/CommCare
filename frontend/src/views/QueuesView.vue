<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Pencil, Plus } from 'lucide-vue-next'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import QueueDialog from '../components/QueueDialog.vue'
import ResourceState from '../components/ResourceState.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { ApiError } from '../lib/api'
import { queuesService } from '../lib/services/configuration.service'
import type { Queue } from '../lib/services/types'
import { useSessionStore } from '../stores/session'

type ResourceMode = 'loading' | 'empty' | 'error' | 'forbidden' | 'ready'

const STRATEGY_LABELS: Record<string, string> = {
  ring_all: 'Ring all',
  round_robin: 'Round robin',
  least_recent: 'Least recent',
  fewest_calls: 'Fewest calls',
  random: 'Random',
}

const session = useSessionStore()
const queues = ref<Queue[]>([])
const state = ref<ResourceMode>('loading')
const errorMessage = ref('')
const dialogOpen = ref(false)
const editingQueue = ref<Queue | null>(null)
const dialogError = ref('')
const pendingDelete = ref<Queue | null>(null)
const token = computed(() => session.current?.token ?? '')

async function loadQueues() {
  state.value = 'loading'
  errorMessage.value = ''
  try {
    queues.value = await queuesService.list(token.value)
    state.value = queues.value.length ? 'ready' : 'empty'
  } catch (error) {
    queues.value = []
    if (error instanceof ApiError && error.status === 403) {
      state.value = 'forbidden'
      errorMessage.value = 'You do not have access to queues.'
      return
    }
    state.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : 'Queues could not be loaded.'
  }
}

function openCreate() {
  editingQueue.value = null
  dialogError.value = ''
  dialogOpen.value = true
}

function openEdit(queue: Queue) {
  editingQueue.value = queue
  dialogError.value = ''
  dialogOpen.value = true
}

async function onSaved() {
  dialogOpen.value = false
  await loadQueues()
}

async function deleteQueue() {
  if (!pendingDelete.value) return
  try {
    await queuesService.remove(pendingDelete.value.id, token.value)
    pendingDelete.value = null
    await loadQueues()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Could not delete queue.'
    state.value = 'error'
    pendingDelete.value = null
  }
}

onMounted(loadQueues)
</script>

<template>
  <div class="page-enter">
    <section class="page-heading">
      <div>
        <p class="eyebrow">Configuration</p>
        <h1>Agent queues</h1>
        <p class="page-heading__copy">Manage ACD queues, distribution strategy, and assigned agents.</p>
      </div>
      <div class="heading-actions">
        <button class="button button--primary" type="button" @click="openCreate">
          <Plus :size="15" /> New queue
        </button>
      </div>
    </section>

    <ResourceState
      v-if="state === 'loading' || state === 'error' || state === 'forbidden'"
      :state="state"
      :message="errorMessage"
      :retryable="state === 'error'"
      @retry="loadQueues"
    />

    <section v-else class="surface table-surface">
      <div class="table-scroll">
        <table v-if="state !== 'empty'">
          <thead>
            <tr>
              <th>Name</th>
              <th>Strategy</th>
              <th>Timing</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="queue in queues" :key="queue.id">
              <td>
                <strong>{{ queue.name }}</strong>
                <template v-if="queue.description"><br /><small>{{ queue.description }}</small></template>
              </td>
              <td>{{ STRATEGY_LABELS[queue.strategy] || queue.strategy }}</td>
              <td>Ring {{ queue.ringTimeoutSeconds }}s · Wait {{ queue.maxWaitTimeSeconds }}s</td>
              <td><StatusBadge :status="queue.enabled ? 'active' : 'inactive'" /></td>
              <td class="table-actions">
                <button class="button button--secondary button--compact" type="button" @click="openEdit(queue)">
                  <Pencil :size="13" /> Edit
                </button>
                <button class="button button--secondary button--compact" type="button" @click="pendingDelete = queue">
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <ResourceState v-if="state === 'empty'" state="empty" title="No queues" message="Create a queue to start distributing calls to agents." />
      </div>
    </section>

    <QueueDialog
      :open="dialogOpen"
      :queue="editingQueue"
      :error="dialogError"
      @cancel="dialogOpen = false"
      @saved="onSaved"
    />
    <ConfirmDialog
      :open="Boolean(pendingDelete)"
      title="Delete this queue?"
      message="This removes the queue after the backend confirms it is not referenced by an inbound route or IVR menu."
      confirm-label="Delete queue"
      @cancel="pendingDelete = null"
      @confirm="deleteQueue"
    />
  </div>
</template>
