<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import CreateUserDialog from '../components/CreateUserDialog.vue'
import EditUserDialog from '../components/EditUserDialog.vue'
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
  actionError.value = ''
}

async function saveUser(payload: { name: string; status: 'active' | 'inactive'; extensionId: string | null }) {
  if (!selected.value) return
  saving.value = true
  actionError.value = ''
  try {
    const patch: { name?: string; status?: 'active' | 'inactive' } = {}
    if (payload.name !== selected.value.name) patch.name = payload.name
    if (payload.status !== selected.value.status) patch.status = payload.status
    if (Object.keys(patch).length) {
      const result = await tenancyService.updateUser(selected.value.id, patch, token.value)
      selected.value = { ...selected.value, ...result.user }
    }

    const previousExtensionId = selected.value.extensions?.[0]?.id ?? null
    if (payload.extensionId !== previousExtensionId) {
      if (previousExtensionId) {
        await tenancyService.unassign(previousExtensionId, token.value)
      }
      if (payload.extensionId) {
        await tenancyService.assign(
          { userId: selected.value.id, extensionIds: [payload.extensionId] },
          token.value,
        )
      }
    }

    selected.value = null
    await loadAll()
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Could not update user.'
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
        <table v-if="state !== 'empty'">
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

    <EditUserDialog
      :open="Boolean(selected)"
      :user="selected"
      :extensions="extensions"
      :submitting="saving"
      :error="actionError"
      @cancel="selected = null"
      @delete="confirmDelete = true"
      @submit="saveUser"
    />

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
