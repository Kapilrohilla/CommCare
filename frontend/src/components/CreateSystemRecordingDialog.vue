<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { Check, CloudUpload, Info, Mic, Upload, X } from 'lucide-vue-next'

export type CreateSystemRecordingPayload =
  | { sourceType: 'upload'; name: string; description?: string; file: File }
  | { sourceType: 'tts'; name: string; description?: string; ttsText: string }

const props = defineProps<{ open: boolean; submitting?: boolean; error?: string }>()
const emit = defineEmits<{
  cancel: []
  submit: [payload: CreateSystemRecordingPayload]
}>()

const name = ref('')
const description = ref('')
const sourceMode = ref<'upload' | 'tts'>('upload')
const ttsText = ref('')
const selectedFile = ref<File | null>(null)
const dragOver = ref(false)
const localError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const referenceId = ref('REC-2024-001')

const nameValid = computed(() => name.value.trim().length >= 2)
const ttsValid = computed(() => ttsText.value.trim().length >= 1)
const fileMeta = computed(() => {
  const file = selectedFile.value
  if (!file) return null
  const sizeMb = (file.size / (1024 * 1024)).toFixed(1)
  return `${file.name} · ${sizeMb} MB`
})
const statusLabel = computed(() => {
  if (sourceMode.value === 'tts') {
    return ttsValid.value ? 'Ready to generate TTS audio' : 'Awaiting TTS script'
  }
  if (selectedFile.value) {
    return `Ready to deploy (${selectedFile.value.name.split('.').pop()?.toUpperCase() ?? 'AUDIO'})`
  }
  return 'Awaiting audio source'
})
const statusReady = computed(() =>
  sourceMode.value === 'tts' ? ttsValid.value : Boolean(selectedFile.value),
)

watch(
  () => props.open,
  (open) => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = open ? 'hidden' : ''
    }
    if (!open) return
    name.value = ''
    description.value = ''
    sourceMode.value = 'upload'
    ttsText.value = ''
    selectedFile.value = null
    dragOver.value = false
    localError.value = ''
    const stamp = String(Math.floor(Math.random() * 900) + 100)
    referenceId.value = `REC-${new Date().getFullYear()}-${stamp}`
  },
)

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
  }
})

function acceptFile(file: File | null | undefined) {
  localError.value = ''
  if (!file) {
    selectedFile.value = null
    return
  }
  if (!/\.(wav|mp3|gsm)$/i.test(file.name)) {
    localError.value = 'File must end in .wav, .mp3, or .gsm.'
    selectedFile.value = null
    return
  }
  if (file.size > 25 * 1024 * 1024) {
    localError.value = 'Max file size is 25MB.'
    selectedFile.value = null
    return
  }
  selectedFile.value = file
  sourceMode.value = 'upload'
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  acceptFile(input.files?.[0])
}

function onDrop(event: DragEvent) {
  dragOver.value = false
  acceptFile(event.dataTransfer?.files?.[0])
}

function onSubmit() {
  localError.value = ''
  if (!nameValid.value) {
    localError.value = 'Enter a recording name.'
    return
  }
  if (sourceMode.value === 'tts') {
    if (!ttsValid.value) {
      localError.value = 'Enter the text to synthesize.'
      return
    }
    emit('submit', {
      sourceType: 'tts',
      name: name.value.trim(),
      description: description.value.trim() || undefined,
      ttsText: ttsText.value.trim(),
    })
    return
  }
  if (!selectedFile.value) {
    localError.value = 'Choose an audio file to upload.'
    return
  }
  emit('submit', {
    sourceType: 'upload',
    name: name.value.trim(),
    description: description.value.trim() || undefined,
    file: selectedFile.value,
  })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="recording-modal-backdrop" role="presentation" @click.self="emit('cancel')">
      <section class="recording-modal" role="dialog" aria-modal="true" aria-labelledby="recording-modal-title">
        <header class="recording-modal__header">
          <div class="recording-modal__tags">
            <span class="recording-modal__badge">System recordings · Asset provisioning</span>
            <span class="recording-modal__meta">{{ referenceId }}</span>
          </div>
          <button class="recording-modal__close" type="button" aria-label="Close" @click="emit('cancel')">
            <X :size="16" />
          </button>
        </header>

        <div class="recording-modal__intro">
          <h2 id="recording-modal-title">New System Recording</h2>
          <p>Configure telephony audio for IVR menus, dialplan greetings, and queue prompts.</p>
        </div>

        <form class="recording-modal__form" @submit.prevent="onSubmit">
          <div class="recording-modal__field">
            <label for="recording-name">Recording name <span aria-hidden="true">*</span></label>
            <div class="recording-modal__input" :class="{ 'is-valid': nameValid }">
              <input
                id="recording-name"
                v-model="name"
                type="text"
                placeholder="Main Greeting — Business Hours v2"
                required
              />
              <Check v-if="nameValid" class="recording-modal__check" :size="16" aria-hidden="true" />
            </div>
          </div>

          <div class="recording-modal__field">
            <label for="recording-description">Description</label>
            <textarea
              id="recording-description"
              v-model="description"
              rows="2"
              placeholder="IVR Key 1 welcome prompt. Routes calls to Family Medicine or Pharmacy Queue."
            />
          </div>

          <section class="recording-modal__source">
            <div class="recording-modal__source-head">
              <h3>Audio source &amp; generation</h3>
              <span class="recording-modal__ready">
                <i aria-hidden="true" />
                Asterisk PJSIP Ready
              </span>
            </div>

            <div class="recording-modal__tabs" role="tablist" aria-label="Audio source">
              <button
                type="button"
                class="recording-modal__tab"
                :class="{ 'is-active': sourceMode === 'upload' }"
                role="tab"
                :aria-selected="sourceMode === 'upload'"
                @click="sourceMode = 'upload'"
              >
                <Upload :size="16" aria-hidden="true" />
                <span>Upload Audio File</span>
                <em class="recording-modal__pill recording-modal__pill--green">WAV / MP3</em>
              </button>
              <button
                type="button"
                class="recording-modal__tab"
                :class="{ 'is-active': sourceMode === 'tts' }"
                role="tab"
                :aria-selected="sourceMode === 'tts'"
                @click="sourceMode = 'tts'"
              >
                <Mic :size="16" aria-hidden="true" />
                <span>Text-to-Speech Studio</span>
                <em class="recording-modal__pill recording-modal__pill--amber">AI TTS</em>
              </button>
            </div>

            <div
              v-if="sourceMode === 'upload'"
              class="recording-modal__dropzone"
              :class="{ 'is-drag': dragOver, 'has-file': Boolean(selectedFile) }"
              @dragenter.prevent="dragOver = true"
              @dragover.prevent="dragOver = true"
              @dragleave.prevent="dragOver = false"
              @drop.prevent="onDrop"
            >
              <div class="recording-modal__drop-icon" aria-hidden="true">
                <CloudUpload :size="20" />
              </div>
              <p class="recording-modal__drop-title">
                <template v-if="selectedFile">{{ fileMeta }}</template>
                <template v-else>
                  Drag and drop your prompt audio here, or
                  <button type="button" class="recording-modal__browse" @click="fileInput?.click()">Browse files</button>
                </template>
              </p>
              <p class="recording-modal__drop-copy">
                Asterisk auto-transcodes to <code>slin</code> 8000Hz / 16-bit Mono upon ingestion.
              </p>
              <div class="recording-modal__formats">
                Supported: <strong>WAV</strong> (8kHz/16kHz recommended), <strong>MP3</strong>. Max file size: 25MB.
              </div>
              <input
                ref="fileInput"
                class="recording-modal__file"
                type="file"
                accept=".wav,.mp3,.gsm,audio/wav,audio/mpeg,audio/*"
                @change="onFileChange"
              />
              <button
                v-if="selectedFile"
                type="button"
                class="recording-modal__replace"
                @click="fileInput?.click()"
              >
                Replace file
              </button>
            </div>

            <div v-else class="recording-modal__tts-panel">
              <div class="recording-modal__field">
                <label for="recording-tts-text">TTS script <span aria-hidden="true">*</span></label>
                <textarea
                  id="recording-tts-text"
                  v-model="ttsText"
                  rows="5"
                  maxlength="10000"
                  placeholder="Thank you for calling. Press 1 for Family Medicine, or press 2 for the Pharmacy queue."
                  required
                />
                <p class="recording-modal__drop-copy">
                  Asterisk will synthesize this script, normalize loudness, and publish a telephony-ready WAV.
                </p>
              </div>
            </div>
          </section>

          <aside class="recording-modal__notice">
            <Info :size="16" aria-hidden="true" />
            <p>
              <strong>Asterisk Audio Compliance:</strong>
              CommCare automatically normalizes audio loudness to
              <strong>−16 LUFS</strong>
              and resamples to
              <code>slin</code> / <code>alaw</code> / <code>ulaw</code>
              for artifact-free WebRTC &amp; PSTN trunk playback without runtime jitter.
            </p>
          </aside>

          <p v-if="localError || error" class="recording-modal__error" role="alert">{{ localError || error }}</p>

          <footer class="recording-modal__footer">
            <span class="recording-modal__status" :class="{ 'is-ready': statusReady }">
              <i aria-hidden="true" />
              Status: <strong>{{ statusLabel }}</strong>
            </span>
            <div class="recording-modal__actions">
              <button class="button button--secondary" type="button" @click="emit('cancel')">Cancel</button>
              <button class="button button--primary" type="submit" :disabled="submitting">
                <Check :size="14" aria-hidden="true" />
                {{ submitting ? 'Saving…' : 'Create & Save Recording' }}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>
