<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ open: boolean; submitting?: boolean; error?: string }>()
const emit = defineEmits<{
  cancel: []
  submit: [payload: {
    sourceType: 'phone_number'
    sourceValue: string
    destinationType: 'hangup' | 'external_number'
    destinationValue?: string
    enabled: boolean
  }]
}>()

const sourceValue = ref('')
const destinationType = ref<'hangup' | 'external_number'>('hangup')
const destinationValue = ref('')
const enabled = ref(true)
const localError = ref('')

watch(
  () => props.open,
  (open) => {
    if (!open) return
    sourceValue.value = ''
    destinationType.value = 'hangup'
    destinationValue.value = ''
    enabled.value = true
    localError.value = ''
  },
)

function onSubmit() {
  localError.value = ''
  if (!sourceValue.value.trim()) {
    localError.value = 'Enter the inbound phone number or DID.'
    return
  }
  if (destinationType.value === 'external_number' && !destinationValue.value.trim()) {
    localError.value = 'Enter an external destination number.'
    return
  }
  emit('submit', {
    sourceType: 'phone_number',
    sourceValue: sourceValue.value.trim(),
    destinationType: destinationType.value,
    destinationValue:
      destinationType.value === 'external_number' ? destinationValue.value.trim() : undefined,
    enabled: enabled.value,
  })
}
</script>

<template>
  <div v-if="open" class="dialog-backdrop" role="presentation" @click.self="emit('cancel')">
    <section class="dialog dialog--form" role="dialog" aria-modal="true" aria-label="New inbound route">
      <span class="overline">Inbound</span>
      <h2>New inbound route</h2>
      <p>Map an inbound phone number to hangup or an external destination.</p>
      <form class="dialog-form" @submit.prevent="onSubmit">
        <label>
          Source phone number
          <input v-model="sourceValue" type="text" placeholder="+14155550100" />
        </label>
        <label>
          Destination
          <select v-model="destinationType">
            <option value="hangup">Hangup</option>
            <option value="external_number">External number</option>
          </select>
        </label>
        <label v-if="destinationType === 'external_number'">
          Destination number
          <input v-model="destinationValue" type="text" placeholder="+14155550138" />
        </label>
        <label class="check-row">
          <input v-model="enabled" type="checkbox" />
          <span>Enabled</span>
        </label>
        <p v-if="localError || error" class="dialer-message dialer-message--error">{{ localError || error }}</p>
        <div class="dialog__actions">
          <button class="button button--secondary" type="button" @click="emit('cancel')">Cancel</button>
          <button class="button button--primary" type="submit" :disabled="submitting">
            {{ submitting ? 'Saving…' : 'Create route' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
