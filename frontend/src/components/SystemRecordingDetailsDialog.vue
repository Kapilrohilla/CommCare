<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import StatusBadge from './StatusBadge.vue'
import { recordingsService, type SystemRecording } from '../lib/services/integrations.service'
import { useSessionStore } from '../stores/session'

const props = defineProps<{
  open: boolean
  recording: SystemRecording | null
}>()

const emit = defineEmits<{ cancel: [] }>()

const session = useSessionStore()
const token = computed(() => session.current?.token ?? '')
const playbackUrl = ref('')
const playbackError = ref(false)
let requestId = 0

const isActive = computed(() => props.recording?.status === 'active')
const isFailed = computed(() => props.recording?.status === 'failed')

const formatLabel = computed(() => {
  const rec = props.recording
  if (!rec) return ''
  const parts: string[] = []
  if (rec.format) parts.push(rec.format)
  if (rec.sampleRate) parts.push(`${Math.round(rec.sampleRate / 1000)}kHz`)
  if (rec.channels) parts.push(rec.channels === 1 ? 'Mono' : 'Stereo')
  return parts.join(' · ')
})

async function loadPlayback(id: string) {
  const current = ++requestId
  playbackUrl.value = ''
  playbackError.value = false
  try {
    const result = await recordingsService.playbackUrl(id, token.value)
    if (current === requestId) playbackUrl.value = result.url
  } catch {
    if (current === requestId) playbackError.value = true
  }
}

watch(
  () => [props.open, props.recording?.id, isActive.value] as const,
  ([open, id, active]) => {
    requestId++
    playbackUrl.value = ''
    playbackError.value = false
    if (open && id && active) void loadPlayback(id)
  },
  { immediate: true },
)

watch(
  () => props.open,
  (open) => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = open ? 'hidden' : ''
    }
  },
)

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open && recording" class="recording-action-backdrop" role="presentation" @click.self="emit('cancel')">
      <section
        class="recording-action-modal recording-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recording-details-title"
        @keydown.esc="emit('cancel')"
      >
        <header class="recording-action-modal__header">
          <div>
            <span class="recording-action-modal__badge">System recording</span>
            <h2 id="recording-details-title">{{ recording.name || recording.id }}</h2>
            <StatusBadge :status="recording.status" />
          </div>
          <button class="recording-action-modal__close" type="button" aria-label="Close" @click="emit('cancel')">
            <X :size="16" />
          </button>
        </header>

        <div class="recording-action-modal__body">
          <p v-if="isFailed" class="recording-details__failure" role="alert">
            <strong>Failure reason</strong>
            {{ recording.errorMessage || 'No reason was recorded.' }}
          </p>

          <dl class="recording-details__grid">
            <div v-if="recording.description" class="recording-details__wide">
              <dt>Description</dt>
              <dd>{{ recording.description }}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{{ recording.sourceType || '—' }}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{{ recording.duration ? `${recording.duration}s` : '—' }}</dd>
            </div>
            <div v-if="formatLabel" class="recording-details__wide">
              <dt>Format</dt>
              <dd>{{ formatLabel }}</dd>
            </div>
            <div v-if="recording.ttsText" class="recording-details__wide">
              <dt>Text</dt>
              <dd class="recording-details__text">{{ recording.ttsText }}</dd>
            </div>
          </dl>

          <div class="recording-details__player">
            <p v-if="isActive && playbackError" class="recording-action-modal__error" role="alert">
              Playback could not be loaded.
            </p>
            <audio v-else-if="isActive && playbackUrl" controls preload="metadata" :src="playbackUrl" />
            <p v-else-if="isActive" class="recording-action-modal__hint">Loading audio…</p>
            <p v-else-if="!isFailed" class="recording-action-modal__hint">Audio is not ready yet.</p>
          </div>
        </div>

        <footer class="recording-action-modal__footer">
          <button class="button button--secondary" type="button" @click="emit('cancel')">Close</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
