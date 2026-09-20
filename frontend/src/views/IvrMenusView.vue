<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import CreateIvrMenuDialog from '../components/CreateIvrMenuDialog.vue'
import ResourceState from '../components/ResourceState.vue'
import { ApiError } from '../lib/api'
import { ivrService } from '../lib/services/configuration.service'
import type { IvrMenu } from '../lib/services/types'
import { useSessionStore } from '../stores/session'

type ResourceMode = 'loading' | 'empty' | 'error' | 'forbidden' | 'ready'

const session = useSessionStore()
const menus = ref<IvrMenu[]>([])
const state = ref<ResourceMode>('loading')
const errorMessage = ref('')
const createOpen = ref(false)
const creating = ref(false)
const createError = ref('')
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

async function createMenu(payload: { description: string; announcementRecordingId?: string }) {
  creating.value = true
  createError.value = ''
  try {
    await ivrService.create(payload, token.value)
    createOpen.value = false
    await loadMenus()
  } catch (error) {
    createError.value = error instanceof Error ? error.message : 'IVR menu could not be created.'
  } finally {
    creating.value = false
  }
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
        <button class="button button--primary" type="button" @click="createOpen = true">
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
              <th>Description</th>
              <th>Announcement</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="menu in menus" :key="menu.id">
              <td><strong>{{ menu.description || menu.name || menu.id }}</strong></td>
              <td>{{ menu.announcementRecordingId || '—' }}</td>
              <td class="table-actions">
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

    <CreateIvrMenuDialog
      :open="createOpen"
      :submitting="creating"
      :error="createError"
      @cancel="createOpen = false"
      @submit="createMenu"
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
