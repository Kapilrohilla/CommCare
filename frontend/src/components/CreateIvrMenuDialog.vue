<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ open: boolean; submitting?: boolean; error?: string }>()
const emit = defineEmits<{
  cancel: []
  submit: [payload: { description: string; announcementRecordingId?: string }]
}>()

const description = ref('')
const announcementRecordingId = ref('')
const localError = ref('')

watch(
  () => props.open,
  (open) => {
    if (!open) return
    description.value = ''
    announcementRecordingId.value = ''
    localError.value = ''
  },
)

function onSubmit() {
  localError.value = ''
  if (!description.value.trim()) {
    localError.value = 'Enter an IVR menu description.'
    return
  }
  const payload: { description: string; announcementRecordingId?: string } = {
    description: description.value.trim(),
  }
  if (announcementRecordingId.value.trim()) {
    payload.announcementRecordingId = announcementRecordingId.value.trim()
  }
  emit('submit', payload)
}
</script>

<template>
  <div v-if="open" class="dialog-backdrop" role="presentation" @click.self="emit('cancel')">
    <section class="dialog dialog--form" role="dialog" aria-modal="true" aria-label="New IVR menu">
      <span class="overline">IVR</span>
      <h2>New IVR menu</h2>
      <p>Create a menu shell. Options and announcement wiring can be refined after creation.</p>
      <form class="dialog-form" @submit.prevent="onSubmit">
        <label>
          Description
          <input v-model="description" type="text" placeholder="Main greeting menu" />
        </label>
        <label>
          Announcement recording ID (optional)
          <input v-model="announcementRecordingId" type="text" placeholder="UUID of an active system recording" />
        </label>
        <p v-if="localError || error" class="dialer-message dialer-message--error">{{ localError || error }}</p>
        <div class="dialog__actions">
          <button class="button button--secondary" type="button" @click="emit('cancel')">Cancel</button>
          <button class="button button--primary" type="submit" :disabled="submitting">
            {{ submitting ? 'Saving…' : 'Create IVR menu' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
