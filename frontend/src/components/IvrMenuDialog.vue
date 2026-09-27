<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Pause, Play, Plus, Volume2, X } from 'lucide-vue-next'
import { ivrOptionsService, ivrService, queuesService } from '../lib/services/configuration.service'
import { recordingsService, type SystemRecording } from '../lib/services/integrations.service'
import { tenancyService } from '../lib/services/tenancy.service'
import type { Extension, IvrMenu, IvrOption, Queue } from '../lib/services/types'
import { useSessionStore } from '../stores/session'
import IvrKeypadRow, { type KeypadRow } from './IvrKeypadRow.vue'

const KEYPAD_DESTINATION_TYPES = [
  { type: 'IB_Queue', label: 'Queue / Hunt Group' },
  { type: 'Extension', label: 'Extension' },
  { type: 'IVR', label: 'IVR Sub-Menu' },
  { type: 'PhoneNumber', label: 'External Number' },
  { type: 'Announcement', label: 'System Recording' },
  { type: 'hangup', label: 'Hangup' },
]

const FINAL_TIMEOUT_DESTINATION_TYPES = KEYPAD_DESTINATION_TYPES

const DIGIT_ORDER = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '*', '#']
const INPUT_TIMEOUT_OPTIONS = [3, 5, 8, 10, 15, 20]
const MAX_RETRY_OPTIONS = [1, 2, 3, 4, 5]
const INVALID_KEY_ACTIONS: Array<{ value: string; label: string }> = [
  { value: 'replay_announcement', label: 'Replay Announcement' },
  { value: 'route_to_final_timeout', label: 'Route to Final Timeout' },
  { value: 'hangup', label: 'Hangup' },
]

function needsIdTarget(type: string): boolean {
  return type === 'IB_Queue' || type === 'Extension' || type === 'IVR' || type === 'Announcement'
}
function needsValueTarget(type: string): boolean {
  return type === 'PhoneNumber'
}

function randomLocalId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const props = defineProps<{ open: boolean; menu?: IvrMenu | null; error?: string }>()
const emit = defineEmits<{ cancel: []; saved: [] }>()

const session = useSessionStore()
const token = computed(() => session.current?.token ?? '')
const isEdit = computed(() => Boolean(props.menu))

const name = ref('')
const description = ref('')
const announcementRecordingId = ref('')
const enabled = ref(true)
const inputTimeoutSeconds = ref(5)
const maxInvalidRetries = ref(3)
const invalidKeyAction = ref('replay_announcement')
const finalTimeoutDestinationType = ref('hangup')
const finalTimeoutDestinationId = ref('')
const finalTimeoutDestinationValue = ref('')

const rows = ref<KeypadRow[]>([])
const originalOptions = ref<IvrOption[]>([])

const extensions = ref<Extension[]>([])
const queues = ref<Queue[]>([])
const ivrMenus = ref<IvrMenu[]>([])
const recordings = ref<SystemRecording[]>([])
const optionsLoading = ref(false)

const submitting = ref(false)
const localError = ref('')

const audioEl = ref<HTMLAudioElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const playbackUrl = ref('')

const selectedRecording = computed(
  () => recordings.value.find((item) => item.id === announcementRecordingId.value) ?? null,
)

const formatBadge = computed(() => {
  const recording = selectedRecording.value
  if (!recording) return ''
  const parts: string[] = []
  if (recording.sampleRate) parts.push(`${Math.round(recording.sampleRate / 1000)}kHz`)
  if (recording.channels) parts.push(recording.channels === 1 ? 'Mono' : 'Stereo')
  if (recording.codec) parts.push(recording.codec.toUpperCase())
  return parts.join(' ')
})

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function resetPlayback() {
  isPlaying.value = false
  currentTime.value = 0
  duration.value = 0
  playbackUrl.value = ''
}

watch(announcementRecordingId, async (id) => {
  resetPlayback()
  if (!id || !token.value) return
  try {
    const result = await recordingsService.playbackUrl(id, token.value)
    playbackUrl.value = result.url
  } catch {
    playbackUrl.value = ''
  }
})

function togglePlay() {
  if (!audioEl.value) return
  if (isPlaying.value) {
    audioEl.value.pause()
  } else {
    void audioEl.value.play()
  }
}
function onAudioPlay() { isPlaying.value = true }
function onAudioPause() { isPlaying.value = false }
function onTimeUpdate() { currentTime.value = audioEl.value?.currentTime ?? 0 }
function onLoadedMetadata() { duration.value = audioEl.value?.duration ?? 0 }

function nextDigit(): string {
  const used = new Set(rows.value.map((row) => row.digit))
  return DIGIT_ORDER.find((digit) => !used.has(digit)) ?? ''
}

function addRow() {
  rows.value.push({
    _localId: randomLocalId(),
    digit: nextDigit(),
    destinationType: 'Extension',
  })
}

function removeRow(localId: string) {
  rows.value = rows.value.filter((row) => row._localId !== localId)
}

const duplicateDigit = computed(() => {
  const seen = new Set<string>()
  for (const row of rows.value) {
    if (!row.digit) continue
    if (seen.has(row.digit)) return row.digit
    seen.add(row.digit)
  }
  return null
})

const missingTargetDigit = computed(() => {
  for (const row of rows.value) {
    if (needsIdTarget(row.destinationType) && !row.destinationId) return row.digit || '(blank)'
    if (needsValueTarget(row.destinationType) && !row.destinationValue?.trim()) {
      return row.digit || '(blank)'
    }
  }
  return null
})

const needsFinalTimeoutId = computed(() => needsIdTarget(finalTimeoutDestinationType.value))
const needsFinalTimeoutValue = computed(() => needsValueTarget(finalTimeoutDestinationType.value))

const statusMessage = computed(() => {
  if (!name.value.trim()) return 'Enter a menu name'
  if (rows.value.some((row) => !row.digit)) return 'Assign a digit to every keypress option'
  if (duplicateDigit.value) return `Duplicate digit ${duplicateDigit.value} assigned twice`
  if (missingTargetDigit.value) return `Select a target for digit ${missingTargetDigit.value}`
  if (needsFinalTimeoutId.value && !finalTimeoutDestinationId.value) {
    return 'Select a final timeout destination target'
  }
  if (needsFinalTimeoutValue.value && !finalTimeoutDestinationValue.value.trim()) {
    return 'Enter a final timeout external number'
  }
  return 'Dialplan syntax valid • No duplicate DTMF assignments'
})

const isValid = computed(
  () =>
    Boolean(name.value.trim()) &&
    !rows.value.some((row) => !row.digit) &&
    !duplicateDigit.value &&
    !missingTargetDigit.value &&
    !(needsFinalTimeoutId.value && !finalTimeoutDestinationId.value) &&
    !(needsFinalTimeoutValue.value && !finalTimeoutDestinationValue.value.trim()),
)

async function loadLookups() {
  if (!token.value) return
  optionsLoading.value = true
  try {
    const [extensionResult, queueResult, ivrResult, recordingResult] = await Promise.allSettled([
      tenancyService.extensions(token.value),
      queuesService.list(token.value),
      ivrService.list(token.value),
      recordingsService.list(token.value),
    ])
    extensions.value = extensionResult.status === 'fulfilled' ? extensionResult.value : []
    queues.value = queueResult.status === 'fulfilled' ? queueResult.value : []
    ivrMenus.value = ivrResult.status === 'fulfilled' ? ivrResult.value : []
    recordings.value = recordingResult.status === 'fulfilled' ? recordingResult.value : []
  } finally {
    optionsLoading.value = false
  }
}

function resetForm() {
  const menu = props.menu
  name.value = menu?.name ?? ''
  description.value = menu?.description ?? ''
  announcementRecordingId.value = menu?.announcementRecordingId ?? ''
  enabled.value = menu?.enabled ?? true
  inputTimeoutSeconds.value = menu?.inputTimeoutSeconds ?? 5
  maxInvalidRetries.value = menu?.maxInvalidRetries ?? 3
  invalidKeyAction.value = menu?.invalidKeyAction ?? 'replay_announcement'
  finalTimeoutDestinationType.value = menu?.finalTimeoutDestinationType ?? 'hangup'
  finalTimeoutDestinationId.value = menu?.finalTimeoutDestinationId ?? ''
  finalTimeoutDestinationValue.value = menu?.finalTimeoutDestinationValue ?? ''
  localError.value = ''
  rows.value = []
  originalOptions.value = []
  resetPlayback()
}

async function loadExistingOptions() {
  if (!props.menu || !token.value) return
  try {
    const options = await ivrOptionsService.list(props.menu.id, token.value)
    originalOptions.value = options
    rows.value = options.map((option) => ({
      _localId: randomLocalId(),
      id: option.id,
      digit: option.digit,
      destinationType: option.destinationType,
      destinationId: option.destinationId ?? undefined,
      destinationValue: option.destinationValue ?? undefined,
      label: option.label ?? undefined,
    }))
  } catch {
    // Leave rows empty — the user can still re-add options; existing ones remain server-side.
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    resetForm()
    void loadLookups()
    void loadExistingOptions()
  },
)

function rowPayload(row: KeypadRow): Partial<IvrOption> {
  const base: Partial<IvrOption> = {
    digit: row.digit,
    destinationType: row.destinationType as IvrOption['destinationType'],
    label: row.label?.trim() || undefined,
  }
  if (needsValueTarget(row.destinationType)) {
    return { ...base, destinationValue: row.destinationValue?.trim() }
  }
  if (needsIdTarget(row.destinationType)) {
    return { ...base, destinationId: row.destinationId }
  }
  return base
}

function rowsEqual(a: IvrOption, b: KeypadRow): boolean {
  return (
    a.digit === b.digit &&
    a.destinationType === b.destinationType &&
    (a.destinationId ?? null) === (b.destinationId ?? null) &&
    (a.destinationValue ?? null) === (b.destinationValue ?? null) &&
    (a.label ?? null) === (b.label ?? null)
  )
}

async function onSubmit() {
  localError.value = ''
  if (!isValid.value) {
    localError.value = statusMessage.value
    return
  }

  submitting.value = true
  try {
    const ivrPayload: Partial<IvrMenu> = {
      name: name.value.trim(),
      description: description.value.trim() || undefined,
      announcementRecordingId: announcementRecordingId.value || undefined,
      enabled: enabled.value,
      inputTimeoutSeconds: inputTimeoutSeconds.value,
      maxInvalidRetries: maxInvalidRetries.value,
      invalidKeyAction: invalidKeyAction.value as IvrMenu['invalidKeyAction'],
      finalTimeoutDestinationType: finalTimeoutDestinationType.value as IvrMenu['finalTimeoutDestinationType'],
      finalTimeoutDestinationId: needsFinalTimeoutId.value ? finalTimeoutDestinationId.value : undefined,
      finalTimeoutDestinationValue: needsFinalTimeoutValue.value
        ? finalTimeoutDestinationValue.value.trim()
        : undefined,
    }

    const savedIvr = isEdit.value
      ? await ivrService.update(props.menu!.id, ivrPayload, token.value)
      : await ivrService.create(ivrPayload, token.value)

    const currentIds = new Set(rows.value.filter((row) => row.id).map((row) => row.id))
    const failures: string[] = []

    for (const original of originalOptions.value) {
      if (currentIds.has(original.id)) continue
      try {
        await ivrOptionsService.remove(savedIvr.id, original.id, token.value)
      } catch (error) {
        failures.push(`digit ${original.digit}: ${error instanceof Error ? error.message : 'delete failed'}`)
      }
    }

    for (const row of rows.value) {
      if (!row.id) continue
      const original = originalOptions.value.find((option) => option.id === row.id)
      if (original && rowsEqual(original, row)) continue
      try {
        await ivrOptionsService.update(savedIvr.id, row.id, rowPayload(row), token.value)
      } catch (error) {
        failures.push(`digit ${row.digit}: ${error instanceof Error ? error.message : 'update failed'}`)
      }
    }

    const newRows = rows.value.filter((row) => !row.id).sort((a, b) => a.digit.localeCompare(b.digit))
    for (const row of newRows) {
      try {
        await ivrOptionsService.create(savedIvr.id, rowPayload(row), token.value)
      } catch (error) {
        failures.push(`digit ${row.digit}: ${error instanceof Error ? error.message : 'create failed'}`)
      }
    }

    if (failures.length) {
      localError.value = `Some keypress options failed to save: ${failures.join('; ')}`
      return
    }

    emit('saved')
  } catch (error) {
    localError.value = error instanceof Error ? error.message : 'IVR menu could not be saved.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="ivr-modal-backdrop" role="presentation" @click.self="emit('cancel')">
      <section class="ivr-modal" role="dialog" aria-modal="true" aria-labelledby="ivr-modal-title">
        <header class="ivr-modal__header">
          <div class="ivr-modal__tags">
            <span class="ivr-modal__badge">Call routing &amp; auto attendant • Asterisk dialplan</span>
          </div>
          <button class="ivr-modal__close" type="button" aria-label="Close" @click="emit('cancel')">
            <X :size="16" />
          </button>
        </header>

        <div class="ivr-modal__intro">
          <h2 id="ivr-modal-title">{{ isEdit ? 'Edit IVR menu' : 'Create IVR menu' }}</h2>
          <p>Configure interactive voice response tree, announcement audio prompt, DTMF keypad routes, and timeout handling.</p>
        </div>

        <form class="ivr-modal__form" @submit.prevent="onSubmit">
          <div class="ivr-modal__body">
            <!-- Section 1: Menu identity -->
            <div class="ivr-modal__section">
              <div class="ivr-modal__section-head">
                <p class="ivr-modal__section-title">1 · Menu identity &amp; dialplan scope</p>
                <button
                  class="ivr-modal__toggle"
                  type="button"
                  role="switch"
                  :aria-checked="enabled"
                  @click="enabled = !enabled"
                >
                  <span class="ivr-modal__toggle-thumb" />
                </button>
              </div>
              <div class="ivr-modal__field">
                <label>Menu name / description <span>*</span></label>
                <input v-model="name" type="text" placeholder="Main Daytime Auto-Attendant" required />
              </div>
              <div class="ivr-modal__field">
                <label>Description (optional)</label>
                <textarea v-model="description" placeholder="Internal notes about this menu" />
              </div>
            </div>

            <!-- Section 2: Announcement -->
            <div class="ivr-modal__section">
              <div class="ivr-modal__section-head">
                <p class="ivr-modal__section-title">2 · Announcement audio prompt (greeting)</p>
                <router-link class="ivr-modal__link" :to="{ name: 'recordings' }" target="_blank">
                  Manage Recordings
                </router-link>
              </div>
              <div class="ivr-modal__field">
                <label>Assigned voice prompt</label>
                <select v-model="announcementRecordingId">
                  <option value="">No announcement</option>
                  <option v-for="recording in recordings" :key="recording.id" :value="recording.id">
                    {{ recording.name }}<template v-if="recording.duration"> ({{ Math.round(recording.duration) }}s)</template>
                  </option>
                </select>
              </div>
              <div v-if="announcementRecordingId" class="ivr-recording-preview">
                <button class="ivr-recording-preview__play" type="button" @click="togglePlay">
                  <Pause v-if="isPlaying" :size="14" />
                  <Play v-else :size="14" />
                </button>
                <audio
                  ref="audioEl"
                  :src="playbackUrl || undefined"
                  @play="onAudioPlay"
                  @pause="onAudioPause"
                  @timeupdate="onTimeUpdate"
                  @loadedmetadata="onLoadedMetadata"
                />
                <span class="ivr-recording-preview__wave" aria-hidden="true">
                  <span v-for="i in 24" :key="i" :class="{ 'is-active': duration > 0 && i / 24 <= currentTime / duration }" :style="{ height: `${6 + ((i * 7) % 14)}px` }" />
                </span>
                <span class="ivr-recording-preview__time">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
                <span v-if="formatBadge" class="ivr-recording-preview__badge">{{ formatBadge }}</span>
                <Volume2 :size="15" aria-hidden="true" />
              </div>
            </div>

            <!-- Section 3: DTMF keypad routing options -->
            <div class="ivr-modal__section">
              <div class="ivr-modal__section-head">
                <p class="ivr-modal__section-title">
                  3 · DTMF keypad routing options
                  <span class="ivr-modal__chip">{{ rows.length }} Keypresses Configured</span>
                </p>
                <button class="button button--secondary button--compact" type="button" @click="addRow">
                  <Plus :size="14" /> Add Keypress Option
                </button>
              </div>

              <p v-if="!rows.length" class="ivr-modal__empty-hint">
                No keypress options yet — add one to start routing digits.
              </p>

              <div v-else class="ivr-keypad-table-wrap">
                <table class="ivr-keypad-table">
                  <thead>
                    <tr>
                      <th>Digit</th>
                      <th>Destination type</th>
                      <th>Target selection</th>
                      <th>Route friendly label</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <IvrKeypadRow
                      v-for="(row, index) in rows"
                      :key="row._localId"
                      v-model="rows[index]"
                      :destination-types="KEYPAD_DESTINATION_TYPES"
                      :extensions="extensions"
                      :queues="queues"
                      :ivr-menus="ivrMenus"
                      :recordings="recordings"
                      :exclude-ivr-id="menu?.id"
                      @remove="removeRow(row._localId)"
                    />
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Section 4: Timeout & fallback -->
            <div class="ivr-modal__section">
              <p class="ivr-modal__section-title">4 · Input timeout &amp; fallback handling</p>
              <div class="ivr-modal__grid-4">
                <div class="ivr-modal__field">
                  <label>Input timeout</label>
                  <select v-model.number="inputTimeoutSeconds">
                    <option v-for="value in INPUT_TIMEOUT_OPTIONS" :key="value" :value="value">{{ value }} seconds</option>
                  </select>
                </div>
                <div class="ivr-modal__field">
                  <label>Max invalid retries</label>
                  <select v-model.number="maxInvalidRetries">
                    <option v-for="value in MAX_RETRY_OPTIONS" :key="value" :value="value">{{ value }} attempts</option>
                  </select>
                </div>
                <div class="ivr-modal__field">
                  <label>Invalid key action</label>
                  <select v-model="invalidKeyAction">
                    <option v-for="option in INVALID_KEY_ACTIONS" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </div>
                <div class="ivr-modal__field">
                  <label>Final timeout destination</label>
                  <select v-model="finalTimeoutDestinationType" @change="finalTimeoutDestinationId = ''; finalTimeoutDestinationValue = ''">
                    <option v-for="option in FINAL_TIMEOUT_DESTINATION_TYPES" :key="option.type" :value="option.type">
                      {{ option.label }}
                    </option>
                  </select>
                </div>
              </div>
              <div v-if="needsFinalTimeoutId" class="ivr-modal__field">
                <label>Final timeout target</label>
                <select v-model="finalTimeoutDestinationId">
                  <option value="" disabled>Select a target</option>
                  <option
                    v-for="item in finalTimeoutDestinationType === 'IB_Queue'
                      ? queues.map((q) => ({ id: q.id, label: q.name }))
                      : finalTimeoutDestinationType === 'Extension'
                        ? extensions.map((e) => ({ id: e.id, label: e.extension }))
                        : finalTimeoutDestinationType === 'IVR'
                          ? ivrMenus.filter((m) => m.id !== menu?.id).map((m) => ({ id: m.id, label: m.name || 'Untitled IVR menu' }))
                          : recordings.map((r) => ({ id: r.id, label: r.name || 'Untitled recording' }))"
                    :key="item.id"
                    :value="item.id"
                  >
                    {{ item.label }}
                  </option>
                </select>
              </div>
              <div v-else-if="needsFinalTimeoutValue" class="ivr-modal__field">
                <label>Final timeout external number</label>
                <input v-model="finalTimeoutDestinationValue" type="text" placeholder="+14155550138" />
              </div>
            </div>
          </div>

          <p v-if="localError || error" class="ivr-modal__error" role="alert">{{ localError || error }}</p>

          <footer class="ivr-modal__footer">
            <span class="ivr-modal__status">
              <span class="ivr-modal__status-dot" :class="{ 'is-ready': isValid }" aria-hidden="true" />
              {{ statusMessage }}
            </span>
            <div class="ivr-modal__actions">
              <button class="button button--secondary" type="button" @click="emit('cancel')">Cancel</button>
              <button
                class="button button--secondary"
                type="button"
                disabled
                title="DTMF simulation is coming soon"
              >
                Test DTMF Simulation
              </button>
              <button class="button button--primary" type="submit" :disabled="submitting || !isValid">
                {{ submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create IVR Menu' }}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>
