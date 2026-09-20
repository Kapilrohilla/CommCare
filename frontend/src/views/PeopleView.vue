<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import CreateUserDialog from '../components/CreateUserDialog.vue'
import DetailDrawer from '../components/DetailDrawer.vue'
import ResourceState from '../components/ResourceState.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { ApiError } from '../lib/api'
import { tenancyService } from '../lib/services/tenancy.service'
import type { Extension, TenantUser } from '../lib/services/types'
import { useSessionStore } from '../stores/session'

type ResourceMode = 'loading' | 'empty' | 'error' | 'forbidden' | 'ready'

const session = useSessionStore()
const users = ref<TenantUser[]>([])
const extensions = ref<Extension[]>([])
const state = ref<ResourceMode>('loading')
const errorMessage = ref('')
const createOpen = ref(false)
const creating = ref(false)
const createError = ref('')
const selected = ref<TenantUser | null>(null)
const editName = ref('')
const saving = ref(false)
const confirmDelete = ref(false)
const actionError = ref('')

const token = computed(() => session.current?.token ?? '')

async function loadAll() {
  state.value = 'loading'
  errorMessage.value = ''
  try {
    const [nextUsers, ext] = await Promise.all([
      tenancyService.users(token.value),
      tenancyService.extensions(token.value),
    ])
    users.value = nextUsers
    extensions.value = ext
    state.value = nextUsers.length ? 'ready' : 'empty'
  } catch (error) {
    users.value = []
    if (error instanceof ApiError && error.status === 403) {
      state.value = 'forbidden'
      errorMessage.value = 'You do not have access to users for this tenant.'
      return
    }
    state.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : 'Users could not be loaded.'
  }
}

async function createUser(payload: {
  name: string
  extensionIds: string[]
  status: 'active' | 'inactive'
}) {
  creating.value = true
  createError.value = ''
  try {
    const created = await tenancyService.createUser(
      { name: payload.name, extensionIds: payload.extensionIds },
      token.value,
    )
    if (payload.status === 'inactive' && created.user?.id) {
      await tenancyService.updateUser(created.user.id, { status: 'inactive' }, token.value)
    }
    createOpen.value = false
    await loadAll()
  } catch (error) {
    createError.value = error instanceof Error ? error.message : 'User could not be created.'
  } finally {
    creating.value = false
  }
}

function openUser(user: TenantUser) {
  selected.value = user
  editName.value = user.name
  actionError.value = ''
}

async function saveUser() {
  if (!selected.value || !editName.value.trim()) return
  saving.value = true
  actionError.value = ''
  try {
    const result = await tenancyService.updateUser(selected.value.id, { name: editName.value.trim() }, token.value)
    selected.value = { ...selected.value, ...result.user }
    await loadAll()
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Could not update user.'
  } finally {
    saving.value = false
  }
}

async function toggleStatus() {
  if (!selected.value) return
  const next = selected.value.status === 'active' ? 'inactive' : 'active'
  saving.value = true
  actionError.value = ''
  try {
    const result = await tenancyService.updateUser(selected.value.id, { status: next }, token.value)
    selected.value = { ...selected.value, ...result.user }
    await loadAll()
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Could not update status.'
  } finally {
    saving.value = false
  }
}

async function deleteUser() {
  if (!selected.value) return
  saving.value = true
  actionError.value = ''
  try {
    await tenancyService.deleteUser(selected.value.id, token.value)
    confirmDelete.value = false
    selected.value = null
    await loadAll()
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Could not delete user.'
  } finally {
    saving.value = false
  }
}

onMounted(loadAll)
</script>

<template>
  <div class="page-enter">
    <section class="page-heading">
      <div>
        <p class="eyebrow">Configuration</p>
        <h1>Users</h1>
        <p class="page-heading__copy">Manage tenant teammates and the extensions assigned to them.</p>
      </div>
      <div class="heading-actions">
        <button class="button button--primary" type="button" @click="createOpen = true">
          <Plus :size="15" /> New user
        </button>
      </div>
    </section>

    <ResourceState
      v-if="state === 'loading' || state === 'error' || state === 'forbidden'"
      :state="state"
      :message="errorMessage"
      :retryable="state === 'error'"
      @retry="loadAll"
    />

    <section v-else class="surface table-surface">
      <div class="surface__header table-header">
        <div>
          <span class="overline">Directory</span>
          <h2>Users</h2>
        </div>
      </div>

      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Extensions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="user in users"
              :key="user.id"
              class="table-row--clickable"
              @click="openUser(user)"
            >
              <td><strong>{{ user.name }}</strong></td>
              <td><StatusBadge :status="user.status" /></td>
              <td>{{ user.extensions?.map((item) => item.extension).join(', ') || '—' }}</td>
            </tr>
          </tbody>
        </table>
        <ResourceState
          v-if="state === 'empty'"
          state="empty"
          title="No users yet"
          message="Create a user and assign an available extension to get started."
        />
      </div>
    </section>

    <CreateUserDialog
      :open="createOpen"
      :extensions="extensions"
      :submitting="creating"
      :error="createError"
      @cancel="createOpen = false"
      @submit="createUser"
    />

    <DetailDrawer :open="Boolean(selected)" :title="selected?.name ?? 'User'" @close="selected = null">
      <form class="drawer-form" @submit.prevent="saveUser">
        <label>
          Name
          <input v-model="editName" type="text" />
        </label>
        <p>Status: <StatusBadge :status="selected?.status ?? 'unknown'" /></p>
        <p>Extensions: {{ selected?.extensions?.map((item) => item.extension).join(', ') || 'None' }}</p>
        <p v-if="actionError" class="dialer-message dialer-message--error">{{ actionError }}</p>
        <div class="dialog__actions">
          <button class="button button--secondary" type="button" :disabled="saving" @click="toggleStatus">
            {{ selected?.status === 'active' ? 'Disable' : 'Enable' }}
          </button>
          <button class="button button--secondary" type="button" :disabled="saving" @click="confirmDelete = true">
            Delete
          </button>
          <button class="button button--primary" type="submit" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </form>
    </DetailDrawer>

    <ConfirmDialog
      :open="confirmDelete"
      title="Delete this user?"
      message="Their extensions will be unassigned first. This cannot be undone from the console."
      confirm-label="Delete user"
      @cancel="confirmDelete = false"
      @confirm="deleteUser"
    />
  </div>
</template>
