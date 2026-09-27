<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Pencil, Plus } from 'lucide-vue-next'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import IvrMenuDialog from '../components/IvrMenuDialog.vue'
import ResourceState from '../components/ResourceState.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { ApiError } from '../lib/api'
import { ivrService } from '../lib/services/configuration.service'
import type { IvrMenu } from '../lib/services/types'
import { useSessionStore } from '../stores/session'

type ResourceMode = 'loading' | 'empty' | 'error' | 'forbidden' | 'ready'

const session = useSessionStore()
const menus = ref<IvrMenu[]>([])
const state = ref<ResourceMode>('loading')
const errorMessage = ref('')
const dialogOpen = ref(false)
const editingMenu = ref<IvrMenu | null>(null)
const dialogError = ref('')
const pendingDelete = ref<IvrMenu | null>(null)
const token = computed(() => session.current?.token ?? '')

async function loadMenus() {
  state.value = 'loading'
  errorMessage.value = ''
  try {
    menus.value = await ivrService.list(token.value)
    state.value = menus.value.length ? 'ready' : 'empty'
  } catch (error) {
    menus.value = []
    if (error instanceof ApiError && error.status === 403) {
      state.value = 'forbidden'
      errorMessage.value = 'You do not have access to IVR menus.'
      return
    }
    state.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : 'IVR menus could not be loaded.'
  }
}

function openCreate() {
  editingMenu.value = null
  dialogError.value = ''
  dialogOpen.value = true
}

function openEdit(menu: IvrMenu) {
  editingMenu.value = menu
  dialogError.value = ''
  dialogOpen.value = true
}

async function onSaved() {
  dialogOpen.value = false
  await loadMenus()
}

async function deleteMenu() {
  if (!pendingDelete.value) return
  try {
    await ivrService.remove(pendingDelete.value.id, token.value)
    pendingDelete.value = null
    await loadMenus()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Could not delete IVR menu.'
    state.value = 'error'
    pendingDelete.value = null
  }
}

onMounted(loadMenus)
</script>

<template>
  <div class="page-enter">
    <section class="page-heading">
      <div>
        <p class="eyebrow">Configuration</p>
        <h1>IVR menus</h1>
        <p class="page-heading__copy">Configure interactive menus and announcement recordings.</p>
      </div>
      <div class="heading-actions">
        <button class="button button--primary" type="button" @click="openCreate">
          <Plus :size="15" /> New IVR menu
        </button>
      </div>
    </section>

    <ResourceState
      v-if="state === 'loading' || state === 'error' || state === 'forbidden'"
      :state="state"
      :message="errorMessage"
      :retryable="state === 'error'"
      @retry="loadMenus"
    />

    <section v-else class="surface table-surface">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Announcement</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="menu in menus" :key="menu.id">
              <td>
                <strong>{{ menu.name || menu.id }}</strong>
                <template v-if="menu.description"><br /><small>{{ menu.description }}</small></template>
              </td>
              <td>{{ menu.announcementRecordingId ? 'Assigned' : '—' }}</td>
              <td><StatusBadge :status="menu.enabled ? 'active' : 'inactive'" /></td>
              <td class="table-actions">
                <button class="button button--secondary button--compact" type="button" @click="openEdit(menu)">
                  <Pencil :size="13" /> Edit
                </button>
                <button class="button button--secondary button--compact" type="button" @click="pendingDelete = menu">
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <ResourceState v-if="state === 'empty'" state="empty" title="No IVR menus" message="Create a menu to start building call trees." />
      </div>
    </section>

    <IvrMenuDialog
      :open="dialogOpen"
      :menu="editingMenu"
      :error="dialogError"
      @cancel="dialogOpen = false"
      @saved="onSaved"
    />
    <ConfirmDialog
      :open="Boolean(pendingDelete)"
      title="Delete IVR menu?"
      message="This removes the menu after the backend confirms deletion."
      confirm-label="Delete menu"
      @cancel="pendingDelete = null"
      @confirm="deleteMenu"
    />
  </div>
</template>
