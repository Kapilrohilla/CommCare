<script setup lang="ts">
import { computed } from 'vue'
import { GripVertical, Trash2 } from 'lucide-vue-next'
import type { SystemRecording } from '../lib/services/integrations.service'
import type { Extension, IvrMenu, Queue } from '../lib/services/types'

export type KeypadRow = {
  _localId: string
  id?: string
  digit: string
  destinationType: string
  destinationId?: string
  destinationValue?: string
  label?: string
}

const props = defineProps<{
  destinationTypes: Array<{ type: string; label: string }>
  extensions: Extension[]
  queues: Queue[]
  ivrMenus: IvrMenu[]
  recordings: SystemRecording[]
  excludeIvrId?: string
}>()
const emit = defineEmits<{ remove: [] }>()
const row = defineModel<KeypadRow>({ required: true })

const needsIdTarget = computed(
  () =>
    row.value.destinationType === 'IB_Queue' ||
    row.value.destinationType === 'Extension' ||
    row.value.destinationType === 'IVR' ||
    row.value.destinationType === 'Announcement',
)
const needsValueTarget = computed(() => row.value.destinationType === 'PhoneNumber')

function extensionLabel(extension: Extension): string {
  const owner = extension.userInfo?.name || extension.callerIdName
  return owner ? `${extension.extension} — ${owner}` : `${extension.extension} — Unassigned`
}

const targetOptions = computed(() => {
  switch (row.value.destinationType) {
    case 'IB_Queue':
      return props.queues.map((item) => ({ id: item.id, label: item.name }))
    case 'Extension':
      return props.extensions.map((item) => ({ id: item.id, label: extensionLabel(item) }))
    case 'IVR':
      return props.ivrMenus
        .filter((item) => item.id !== props.excludeIvrId)
        .map((item) => ({ id: item.id, label: item.name || 'Untitled IVR menu' }))
    case 'Announcement':
      return props.recordings.map((item) => ({ id: item.id, label: item.name || 'Untitled recording' }))
    default:
      return []
  }
})

function onDestinationTypeChange() {
  row.value.destinationId = undefined
  row.value.destinationValue = undefined
}
</script>

<template>
  <tr class="ivr-keypad-row">
    <td>
      <input v-model="row.digit" class="ivr-keypad-row__digit" type="text" maxlength="1" placeholder="1" />
    </td>
    <td>
      <select v-model="row.destinationType" @change="onDestinationTypeChange">
        <option v-for="option in destinationTypes" :key="option.type" :value="option.type">
          {{ option.label }}
        </option>
      </select>
    </td>
    <td>
      <select v-if="needsIdTarget" v-model="row.destinationId">
        <option value="" disabled>Select a target</option>
        <option v-for="option in targetOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
      </select>
      <input
        v-else-if="needsValueTarget"
        v-model="row.destinationValue"
        type="text"
        placeholder="+14155550138"
      />
      <span v-else class="ivr-keypad-row__no-target">—</span>
    </td>
    <td>
      <input v-model="row.label" type="text" placeholder="e.g. Customer Support" />
    </td>
    <td class="ivr-keypad-row__actions">
      <span class="ivr-keypad-row__drag" title="Order is cosmetic only" aria-hidden="true">
        <GripVertical :size="16" />
      </span>
      <button
        type="button"
        class="ivr-keypad-row__delete"
        aria-label="Remove keypress option"
        @click="emit('remove')"
      >
        <Trash2 :size="15" />
      </button>
    </td>
  </tr>
</template>
