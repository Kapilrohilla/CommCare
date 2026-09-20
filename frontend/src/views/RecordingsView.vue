<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Plus } from 'lucide-vue-next'
import DetailDrawer from '../components/DetailDrawer.vue'
import ResourceState from '../components/ResourceState.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { ApiError } from '../lib/api'
import { recordingsService, type SystemRecording } from '../lib/services/integrations.service'
import { useSessionStore } from '../stores/session'

type ResourceMode = 'loading' | 'empty' | 'error' | 'forbidden' | 'ready'

const session = useSessionStore()
const recordings = ref<SystemRecording[]>([])
const state = ref<ResourceMode>('loading')
const errorMessage = ref('')
const selected = ref<SystemRecording | null>(null)
const creating = ref(false)
const uploading = ref(false)
const actionError = ref('')
const newName = ref('')
const selectedFile = ref<File | null>(null)
const createOpen = ref(false)
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
      selected.value = latest
      recordings.value = recordings.value.map((item) => (item.id === id ? latest : item))
      if (latest.status === 'active' || latest.status === 'failed') stopPolling()
    } catch {
      // keep last confirmed state
    }
  }, 2500)
}

async function createRecording() {
  if (!newName.value.trim()) {
    actionError.value = 'Enter a recording name.'
    return
  }
  creating.value = true
  actionError.value = ''
  try {
    const created = await recordingsService.create({ name: newName.value.trim() }, token.value)
    createOpen.value = false
    newName.value = ''
    await loadRecordings()
    selected.value = created
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Recording could not be created.'
  } finally {
    creating.value = false
  }
}

async function uploadAudio() {
  if (!selected.value || !selectedFile.value) {
    actionError.value = 'Choose an audio file to upload (.wav, .mp3, or .gsm).'
    return
  }
  const fileName = selectedFile.value.name
  if (!/\.(wav|mp3|gsm)$/i.test(fileName)) {
    actionError.value = 'File must end in .wav, .mp3, or .gsm.'
    return
  }
  uploading.value = true
  actionError.value = ''
  try {
    await recordingsService.update(selected.value.id, { sourceType: 'upload' }, token.value)
    const { url } = await recordingsService.uploadUrl(selected.value.id, fileName, token.value)
    await fetch(url, { method: 'PUT', body: selectedFile.value, headers: { 'Content-Type': selectedFile.value.type || 'application/octet-stream' } })
    const confirmed = await recordingsService.confirmUpload(selected.value.id, fileName, token.value)
    selected.value = confirmed
    selectedFile.value = null
    startPolling(confirmed.id)
    await loadRecordings()
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Upload failed.'
  } finally {
    uploading.value = false
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
          Upload announcement audio for IVR. Text-to-speech generation is supported by the backend but deferred in this UI.
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
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Source</th>
              <th>Status</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="recording in recordings"
              :key="recording.id"
              class="table-row--clickable"
              @click="selected = recording"
            >
              <td><strong>{{ recording.name || recording.id }}</strong></td>
              <td>{{ recording.sourceType || '—' }}</td>
              <td><StatusBadge :status="recording.status" /></td>
              <td>{{ recording.duration ? `${recording.duration}s` : '—' }}</td>
            </tr>
          </tbody>
        </table>
        <ResourceState v-if="state === 'empty'" state="empty" title="No system recordings" message="Create a recording shell, then upload audio." />
      </div>
    </section>

    <div v-if="createOpen" class="dialog-backdrop" role="presentation" @click.self="createOpen = false">
      <section class="dialog dialog--form" role="dialog" aria-modal="true" aria-label="New system recording">
        <span class="overline">Recordings</span>
        <h2>New system recording</h2>
        <p>Creates a pending recording. Upload audio next; TTS remains future scope in the UI.</p>
        <form class="dialog-form" @submit.prevent="createRecording">
          <label>Name<input v-model="newName" type="text" placeholder="Main greeting" /></label>
          <p v-if="actionError" class="dialer-message dialer-message--error">{{ actionError }}</p>
          <div class="dialog__actions">
            <button class="button button--secondary" type="button" @click="createOpen = false">Cancel</button>
            <button class="button button--primary" type="submit" :disabled="creating">
              {{ creating ? 'Creating…' : 'Create' }}
            </button>
          </div>
        </form>
      </section>
    </div>

    <DetailDrawer :open="Boolean(selected)" :title="selected?.name ?? 'Recording'" @close="selected = null; stopPolling()">
      <div class="drawer-form">
        <p>Status: <StatusBadge :status="selected?.status ?? 'unknown'" /></p>
        <p>Source: {{ selected?.sourceType || 'Not set' }}</p>
        <p v-if="selected?.errorMessage" class="dialer-message dialer-message--error">{{ selected.errorMessage }}</p>
        <p class="field-hint">TTS generation is available on the backend (`sourceType: tts`) but is out of scope for this UI release.</p>
        <label>
          Upload audio
          <input type="file" accept=".wav,.mp3,.gsm,audio/*" @change="selectedFile = ($event.target as HTMLInputElement).files?.[0] ?? null" />
        </label>
        <p v-if="actionError" class="dialer-message dialer-message--error">{{ actionError }}</p>
        <div class="dialog__actions">
          <button class="button button--primary" type="button" :disabled="uploading" @click="uploadAudio">
            {{ uploading ? 'Uploading…' : 'Upload & process' }}
          </button>
        </div>
      </div>
    </DetailDrawer>
  </div>
</template>
