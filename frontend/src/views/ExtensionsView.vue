<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import ResourceState from '../components/ResourceState.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { ApiError } from '../lib/api'
import { tenancyService } from '../lib/services/tenancy.service'
import type { Extension } from '../lib/services/types'
import { useSessionStore } from '../stores/session'

type ResourceMode = 'loading' | 'empty' | 'error' | 'forbidden' | 'ready'
type PendingAction = { type: 'unassign' | 'unregister'; extension: Extension } | null

const session = useSessionStore()
const extensions = ref<Extension[]>([])
const state = ref<ResourceMode>('loading')
const errorMessage = ref('')
const pending = ref<PendingAction>(null)
const acting = ref(false)

const token = computed(() => session.current?.token ?? '')

async function loadExtensions() {
  state.value = 'loading'
  errorMessage.value = ''
  try {
    extensions.value = await tenancyService.extensions(token.value)
    state.value = extensions.value.length ? 'ready' : 'empty'
  } catch (error) {
    extensions.value = []
    if (error instanceof ApiError && error.status === 403) {
      state.value = 'forbidden'
      errorMessage.value = 'You do not have access to extensions for this tenant.'
      return
    }
    state.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : 'Extensions could not be loaded.'
  }
}

async function confirmAction() {
  if (!pending.value) return
  acting.value = true
  try {
    if (pending.value.type === 'unassign') {
      await tenancyService.unassign(pending.value.extension.id, token.value)
    } else {
      await tenancyService.unregister(pending.value.extension.id, token.value)
    }
    pending.value = null
    await loadExtensions()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Extension action failed.'
    state.value = 'error'
    pending.value = null
  } finally {
    acting.value = false
  }
}

onMounted(loadExtensions)
</script>

<template>
  <div class="page-enter">
    <section class="page-heading">
      <div>
        <p class="eyebrow">Configuration</p>
        <h1>Extensions</h1>
        <p class="page-heading__copy">Review reserved and assigned extensions for this tenant.</p>
      </div>
    </section>

    <ResourceState
      v-if="state === 'loading' || state === 'error' || state === 'forbidden'"
      :state="state"
      :message="errorMessage"
      :retryable="state === 'error'"
      @retry="loadExtensions"
    />

    <section v-else class="surface table-surface">
      <div class="surface__header">
        <div>
          <span class="overline">Inventory</span>
          <h2>Tenant extensions</h2>
        </div>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Extension</th>
              <th>Status</th>
              <th>Assignee</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in extensions" :key="item.id">
              <td><strong>{{ item.extension }}</strong></td>
              <td><StatusBadge :status="item.status" /></td>
              <td>{{ item.userInfo?.name || item.userId || '—' }}</td>
              <td class="table-actions">
                <button
                  v-if="item.userId"
                  class="button button--secondary button--compact"
                  type="button"
                  @click="pending = { type: 'unassign', extension: item }"
                >
                  Unassign
                </button>
                <button
                  v-else
                  class="button button--secondary button--compact"
                  type="button"
                  @click="pending = { type: 'unregister', extension: item }"
                >
                  Unregister
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <ResourceState
          v-if="state === 'empty'"
          state="empty"
          title="No extensions yet"
          message="Reserve extensions for this tenant before assigning people."
        />
      </div>
    </section>

    <ConfirmDialog
      :open="Boolean(pending)"
      :title="pending?.type === 'unassign' ? 'Unassign extension?' : 'Unregister extension?'"
      :message="pending?.type === 'unassign'
        ? `Unassign ${pending?.extension.extension} from its current person.`
        : `Return ${pending?.extension.extension} to the available pool.`"
      :confirm-label="acting ? 'Working…' : 'Confirm'"
      @cancel="pending = null"
      @confirm="confirmAction"
    />
  </div>
</template>
