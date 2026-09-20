<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ open: boolean; submitting?: boolean; error?: string }>()
const emit = defineEmits<{
  cancel: []
  submit: [payload: { name: string; description?: string; endpoint: string; method: string; triggerEvent: string }]
}>()

const name = ref('')
const description = ref('')
const endpoint = ref('')
const method = ref('post')
const triggerEvent = ref('Click2Call.CalleeConnected')
const localError = ref('')

watch(
  () => props.open,
  (open) => {
    if (!open) return
    name.value = ''
    description.value = ''
    endpoint.value = ''
    method.value = 'post'
    triggerEvent.value = 'Click2Call.CalleeConnected'
    localError.value = ''
  },
)

function onSubmit() {
  localError.value = ''
  if (!name.value.trim() || !endpoint.value.trim()) {
    localError.value = 'Name and endpoint URL are required.'
    return
  }
  emit('submit', {
    name: name.value.trim(),
    description: description.value.trim() || undefined,
    endpoint: endpoint.value.trim(),
    method: method.value,
    triggerEvent: triggerEvent.value,
  })
}
</script>

<template>
  <div v-if="open" class="dialog-backdrop" role="presentation" @click.self="emit('cancel')">
    <section class="dialog dialog--form" role="dialog" aria-modal="true" aria-label="New webhook">
      <span class="overline">Webhooks</span>
      <h2>New webhook</h2>
      <p>Register an HTTPS endpoint for call lifecycle events. Secrets are never shown in the table.</p>
      <form class="dialog-form" @submit.prevent="onSubmit">
        <label>Name<input v-model="name" type="text" placeholder="CRM sync" /></label>
        <label>Description<input v-model="description" type="text" placeholder="Optional" /></label>
        <label>Endpoint URL<input v-model="endpoint" type="text" placeholder="https://example.com/hooks/calls" /></label>
        <label>
          Method
          <select v-model="method">
            <option value="post">POST</option>
            <option value="put">PUT</option>
            <option value="patch">PATCH</option>
          </select>
        </label>
        <label>
          Trigger event
          <select v-model="triggerEvent">
            <option value="Click2Call.CalleeConnected">Click2Call.CalleeConnected</option>
            <option value="Click2Call.CalleeDisconnected">Click2Call.CalleeDisconnected</option>
            <option value="Click2Call.CallerConnected">Click2Call.CallerConnected</option>
            <option value="Click2Call.CallerDisconnected">Click2Call.CallerDisconnected</option>
            <option value="Click2Call.CallerNoAnswer">Click2Call.CallerNoAnswer</option>
            <option value="Click2Call.CalleeNoAnswer">Click2Call.CalleeNoAnswer</option>
          </select>
        </label>
        <p v-if="localError || error" class="dialer-message dialer-message--error">{{ localError || error }}</p>
        <div class="dialog__actions">
          <button class="button button--secondary" type="button" @click="emit('cancel')">Cancel</button>
          <button class="button button--primary" type="submit" :disabled="submitting">
            {{ submitting ? 'Creating…' : 'Create webhook' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
