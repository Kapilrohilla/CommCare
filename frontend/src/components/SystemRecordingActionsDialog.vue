<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { Trash2, X } from 'lucide-vue-next'
import type { SystemRecording } from '../lib/services/integrations.service'

const props = defineProps<{
  open: boolean
  recording: SystemRecording | null
  submitting?: boolean
  error?: string
}>()

const emit = defineEmits<{
  cancel: []
  delete: []
}>()

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
        class="recording-action-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recording-action-title"
      >
        <header class="recording-action-modal__header">
          <div>
            <span class="recording-action-modal__badge">System recordings</span>
            <h2 id="recording-action-title">Take action on system recording</h2>
            <p>
              Choose an action for
              <strong>{{ recording.name || recording.id }}</strong>.
            </p>
          </div>
          <button class="recording-action-modal__close" type="button" aria-label="Close" @click="emit('cancel')">
            <X :size="16" />
          </button>
        </header>

        <div class="recording-action-modal__body">
          <button
            class="recording-action-modal__option"
            type="button"
            :disabled="submitting || recording.status === 'processing'"
            @click="emit('delete')"
          >
            <span class="recording-action-modal__option-icon" aria-hidden="true">
              <Trash2 :size="16" />
            </span>
            <span class="recording-action-modal__option-copy">
              <strong>Delete system recording</strong>
              <small>Soft-delete this recording so it leaves the list and cannot be used in IVR menus.</small>
            </span>
          </button>

          <p v-if="recording.status === 'processing'" class="recording-action-modal__hint">
            Delete is unavailable while this recording is processing.
          </p>
          <p v-if="error" class="recording-action-modal__error" role="alert">{{ error }}</p>
        </div>

        <footer class="recording-action-modal__footer">
          <button class="button button--secondary" type="button" @click="emit('cancel')">Cancel</button>
          <button
            class="button button--primary"
            type="button"
            :disabled="submitting || recording.status === 'processing'"
            @click="emit('delete')"
          >
            <Trash2 :size="14" aria-hidden="true" />
            {{ submitting ? 'Deleting…' : 'Delete recording' }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
