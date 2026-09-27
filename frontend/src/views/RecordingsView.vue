<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { MoreHorizontal, Plus } from 'lucide-vue-next'
import CreateSystemRecordingDialog, {
  type CreateSystemRecordingPayload,
} from '../components/CreateSystemRecordingDialog.vue'
import ResourceState from '../components/ResourceState.vue'
import StatusBadge from '../components/StatusBadge.vue'
import SystemRecordingActionsDialog from '../components/SystemRecordingActionsDialog.vue'
import { ApiError } from '../lib/api'
import { recordingsService, type SystemRecording } from '../lib/services/integrations.service'
import { useSessionStore } from '../stores/session'

type ResourceMode = 'loading' | 'empty' | 'error' | 'forbidden' | 'ready'

const session = useSessionStore()
const recordings = ref<SystemRecording[]>([])
const state = ref<ResourceMode>('loading')
const errorMessage = ref('')
const actionTarget = ref<SystemRecording | null>(null)
const creating = ref(false)
const deleting = ref(false)
const createError = ref('')
const actionError = ref('')
const createOpen = ref(false)
const actionsOpen = ref(false)
let pollTimer: ReturnType<typeof setInterval> | null = null
const token = computed(() => session.current?.token ?? '')

async function loadRecordings() {
  state.value = 'loading'
  errorMessage.value = ''
  try {
    recordings.value = await recordingsService.list(token.value)
    state.value = recordings.value.length ? 'ready' : 'empty'
  } catch (error) {
    recordings.value = []
    if (error instanceof ApiError && error.status === 403) {
      state.value = 'forbidden'
      errorMessage.value = 'You do not have access to system recordings.'
      return
    }
    state.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : 'System recordings could not be loaded.'
  }
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function startPolling(id: string) {
  stopPolling()
  pollTimer = setInterval(async () => {
    try {
      const latest = await recordingsService.get(id, token.value)
      recordings.value = recordings.value.map((item) => (item.id === id ? latest : item))
      if (actionTarget.value?.id === id) actionTarget.value = latest
      if (latest.status === 'active' || latest.status === 'failed') stopPolling()
    } catch {
      // keep last confirmed state
    }
  }, 2500)
}

function openActions(recording: SystemRecording) {
  actionTarget.value = recording
  actionError.value = ''
  actionsOpen.value = true
}

function closeActions() {
  actionsOpen.value = false
  actionTarget.value = null
  actionError.value = ''
}

async function createRecording(payload: CreateSystemRecordingPayload) {
  creating.value = true
  createError.value = ''
  try {
    const created = await recordingsService.create(
      { name: payload.name, description: payload.description },
      token.value,
    )

    if (payload.sourceType === 'tts') {
      await recordingsService.update(
        created.id,
        { sourceType: 'tts', ttsText: payload.ttsText },
        token.value,
      )
      const processing = await recordingsService.process(created.id, token.value)
      createOpen.value = false
      await loadRecordings()
      startPolling(processing.id)
      return
    }

    await recordingsService.update(created.id, { sourceType: 'upload' }, token.value)
    const { url } = await recordingsService.uploadUrl(created.id, payload.file.name, token.value)
    await fetch(url, {
      method: 'PUT',
      body: payload.file,
      headers: { 'Content-Type': payload.file.type || 'application/octet-stream' },
    })
    const confirmed = await recordingsService.confirmUpload(created.id, payload.file.name, token.value)
    createOpen.value = false
    await loadRecordings()
    startPolling(confirmed.id)
  } catch (error) {
    createError.value = error instanceof Error ? error.message : 'Recording could not be created.'
  } finally {
    creating.value = false
  }
}

async function deleteRecording() {
  if (!actionTarget.value) return
  deleting.value = true
  actionError.value = ''
  try {
    await recordingsService.remove(actionTarget.value.id, token.value)
    closeActions()
    stopPolling()
    await loadRecordings()
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Recording could not be deleted.'
  } finally {
    deleting.value = false
  }
}

onMounted(loadRecordings)
onUnmounted(stopPolling)
</script>

<template>
  <div class="page-enter">
    <section class="page-heading">
      <div>
        <p class="eyebrow">Configuration</p>
        <h1>System recordings</h1>
        <p class="page-heading__copy">
          Upload announcement audio or generate TTS prompts for IVR menus and dialplan greetings.
        </p>
      </div>
      <div class="heading-actions">
        <button class="button button--primary" type="button" @click="createOpen = true">
          <Plus :size="15" /> New recording
        </button>
      </div>
    </section>

    <ResourceState
      v-if="state === 'loading' || state === 'error' || state === 'forbidden'"
      :state="state"
      :message="errorMessage"
      :retryable="state === 'error'"
      @retry="loadRecordings"
    />

    <section v-else class="surface table-surface">
      <div class="table-scroll">
        <table v-if="state !== 'empty'">
          <thead>
            <tr>
              <th>Name</th>
              <th>Source</th>
              <th>Status</th>
              <th>Duration</th>
              <th class="table-actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="recording in recordings" :key="recording.id">
              <td><strong>{{ recording.name || recording.id }}</strong></td>
              <td>{{ recording.sourceType || '—' }}</td>
              <td><StatusBadge :status="recording.status" /></td>
              <td>{{ recording.duration ? `${recording.duration}s` : '—' }}</td>
              <td class="table-actions-col">
                <button
                  class="icon-button"
                  type="button"
                  aria-label="Take action on system recording"
                  @click="openActions(recording)"
                >
                  <MoreHorizontal :size="17" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <ResourceState
          v-if="state === 'empty'"
          state="empty"
          title="No system recordings"
          message="Create a recording and upload audio or generate TTS for IVR prompts."
        />
      </div>
    </section>

    <CreateSystemRecordingDialog
      :open="createOpen"
      :submitting="creating"
      :error="createError"
      @cancel="createOpen = false"
      @submit="createRecording"
    />

    <SystemRecordingActionsDialog
      :open="actionsOpen"
      :recording="actionTarget"
      :submitting="deleting"
      :error="actionError"
      @cancel="closeActions"
      @delete="deleteRecording"
    />
  </div>
</template>
