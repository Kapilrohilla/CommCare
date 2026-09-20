<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Extension } from '../lib/services/types'

const props = defineProps<{
  open: boolean
  extensions: Extension[]
  submitting?: boolean
  error?: string
}>()
const emit = defineEmits<{ cancel: []; submit: [payload: { name: string; extensionIds: string[] }] }>()

const name = ref('')
const selectedIds = ref<string[]>([])
const localError = ref('')

const availableExtensions = computed(() =>
  props.extensions.filter((item) => !item.userId && item.status !== 'disabled'),
)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    name.value = ''
    selectedIds.value = availableExtensions.value[0] ? [availableExtensions.value[0].id] : []
    localError.value = ''
  },
)

function toggleExtension(id: string) {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter((item) => item !== id)
    return
  }
  selectedIds.value = [...selectedIds.value, id]
}

function onSubmit() {
  localError.value = ''
  if (!name.value.trim()) {
    localError.value = 'Enter a person name.'
    return
  }
  if (!selectedIds.value.length) {
    localError.value = 'Select at least one available extension.'
    return
  }
  emit('submit', { name: name.value.trim(), extensionIds: [...selectedIds.value] })
}
</script>

<template>
  <div v-if="open" class="dialog-backdrop" role="presentation" @click.self="emit('cancel')">
    <section class="dialog dialog--form" role="dialog" aria-modal="true" aria-label="New person">
      <span class="overline">People</span>
      <h2>New person</h2>
      <p>Create a tenant teammate and assign at least one available extension.</p>

      <form class="dialog-form" @submit.prevent="onSubmit">
        <label>
          Name
          <input v-model="name" type="text" placeholder="Maya Chen" autocomplete="off" />
        </label>

        <fieldset>
          <legend>Extensions</legend>
          <p v-if="!availableExtensions.length" class="field-hint">No unassigned extensions are available. Reserve extensions first.</p>
          <label v-for="item in availableExtensions" :key="item.id" class="check-row">
            <input
              type="checkbox"
              :checked="selectedIds.includes(item.id)"
              @change="toggleExtension(item.id)"
            />
            <span>{{ item.extension }} · {{ item.status }}</span>
          </label>
        </fieldset>

        <p v-if="localError || error" class="dialer-message dialer-message--error">{{ localError || error }}</p>

        <div class="dialog__actions">
          <button class="button button--secondary" type="button" @click="emit('cancel')">Cancel</button>
          <button class="button button--primary" type="submit" :disabled="submitting || !availableExtensions.length">
            {{ submitting ? 'Creating…' : 'Create person' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
