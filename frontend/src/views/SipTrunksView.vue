<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Plus, RefreshCw } from 'lucide-vue-next'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import CreateSipTrunkDialog from '../components/CreateSipTrunkDialog.vue'
import ResourceState from '../components/ResourceState.vue'
import SensitiveValue from '../components/SensitiveValue.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { ApiError } from '../lib/api'
import { trunksService } from '../lib/services/configuration.service'
import type { SipTrunk } from '../lib/services/types'
import { useSessionStore } from '../stores/session'

type ResourceMode = 'loading' | 'empty' | 'error' | 'forbidden' | 'ready'

const session = useSessionStore()
const trunks = ref<SipTrunk[]>([])
const state = ref<ResourceMode>('loading')
const errorMessage = ref('')
const createOpen = ref(false)
const creating = ref(false)
const createError = ref('')
const pendingDelete = ref<SipTrunk | null>(null)
const token = computed(() => session.current?.token ?? '')

async function loadTrunks() {
  state.value = 'loading'
  errorMessage.value = ''
  try {
    trunks.value = await trunksService.list(token.value)
    state.value = trunks.value.length ? 'ready' : 'empty'
  } catch (error) {
    trunks.value = []
    if (error instanceof ApiError && error.status === 403) {
      state.value = 'forbidden'
      errorMessage.value = 'You do not have access to SIP trunks.'
      return
    }
    state.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : 'SIP trunks could not be loaded.'
  }
}

async function createTrunk(payload: {
  name: string
  authMode: 'ip' | 'credentials'
  username?: string
  password?: string
  identifyIps?: string[]
  enabled: boolean
}) {
  creating.value = true
  createError.value = ''
  try {
    await trunksService.create(payload, token.value)
    createOpen.value = false
    await loadTrunks()
  } catch (error) {
    createError.value = error instanceof Error ? error.message : 'Trunk could not be created.'
  } finally {
    creating.value = false
  }
}

async function toggleEnabled(trunk: SipTrunk) {
  try {
    await trunksService.update(trunk.id, { enabled: !trunk.enabled }, token.value)
    await loadTrunks()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Could not update trunk.'
    state.value = 'error'
  }
}

async function syncTrunk(trunk: SipTrunk) {
  try {
    await trunksService.sync(trunk.id, token.value)
    await loadTrunks()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Asterisk sync failed.'
    state.value = 'error'
  }
}

async function deleteTrunk() {
  if (!pendingDelete.value) return
  try {
    await trunksService.remove(pendingDelete.value.id, token.value)
    pendingDelete.value = null
    await loadTrunks()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Could not delete trunk.'
    state.value = 'error'
    pendingDelete.value = null
  }
}

onMounted(loadTrunks)
</script>

<template>
  <div class="page-enter">
    <section class="page-heading">
      <div>
        <p class="eyebrow">Configuration</p>
        <h1>SIP trunks</h1>
        <p class="page-heading__copy">Manage carrier trunks, credentials, and Asterisk sync.</p>
      </div>
      <div class="heading-actions">
        <button class="button button--primary" type="button" @click="createOpen = true">
          <Plus :size="15" /> New SIP trunk
        </button>
      </div>
    </section>

    <ResourceState
      v-if="state === 'loading' || state === 'error' || state === 'forbidden'"
      :state="state"
      :message="errorMessage"
      :retryable="state === 'error'"
      @retry="loadTrunks"
    />

    <section v-else class="surface table-surface">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Auth</th>
              <th>Username</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="trunk in trunks" :key="trunk.id">
              <td><strong>{{ trunk.name }}</strong></td>
              <td>{{ trunk.authMode }}</td>
              <td><SensitiveValue :value="trunk.username" write-only /></td>
              <td><StatusBadge :status="trunk.enabled ? 'active' : 'inactive'" /></td>
              <td class="table-actions">
                <button class="button button--secondary button--compact" type="button" @click="syncTrunk(trunk)">
                  <RefreshCw :size="14" /> Sync
                </button>
                <button class="button button--secondary button--compact" type="button" @click="toggleEnabled(trunk)">
                  {{ trunk.enabled ? 'Disable' : 'Enable' }}
                </button>
                <button class="button button--secondary button--compact" type="button" @click="pendingDelete = trunk">
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <ResourceState v-if="state === 'empty'" state="empty" title="No SIP trunks" message="Create a trunk to connect outbound/inbound carrier paths." />
      </div>
    </section>

    <CreateSipTrunkDialog
      :open="createOpen"
      :submitting="creating"
      :error="createError"
      @cancel="createOpen = false"
      @submit="createTrunk"
    />
    <ConfirmDialog
      :open="Boolean(pendingDelete)"
      title="Delete SIP trunk?"
      message="This removes the trunk after backend confirmation and Asterisk cleanup."
      confirm-label="Delete trunk"
      @cancel="pendingDelete = null"
      @confirm="deleteTrunk"
    />
  </div>
</template>
