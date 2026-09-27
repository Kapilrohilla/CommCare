<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { trunksService } from '../lib/services/configuration.service'
import type { PhoneNumber, SipTrunk } from '../lib/services/types'
import { useSessionStore } from '../stores/session'

const props = defineProps<{
  open: boolean
  phoneNumber?: PhoneNumber | null
  submitting?: boolean
  error?: string
}>()
const emit = defineEmits<{
  cancel: []
  submit: [payload: {
    number: string
    sipTrunkId: string
    name: string
    description?: string
    status: 'active' | 'inactive'
  }]
}>()

const session = useSessionStore()
const token = computed(() => session.current?.token ?? '')
const isEdit = computed(() => Boolean(props.phoneNumber))

const number = ref('')
const sipTrunkId = ref('')
const name = ref('')
const description = ref('')
const status = ref<'active' | 'inactive'>('active')
const localError = ref('')

const trunks = ref<SipTrunk[]>([])
const trunksLoading = ref(false)

async function loadTrunks() {
  if (!token.value) return
  trunksLoading.value = true
  try {
    trunks.value = await trunksService.list(token.value)
  } catch {
    trunks.value = []
  } finally {
    trunksLoading.value = false
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    number.value = props.phoneNumber?.number ?? ''
    sipTrunkId.value = props.phoneNumber?.sipTrunkId ?? ''
    name.value = props.phoneNumber?.name ?? ''
    description.value = props.phoneNumber?.description ?? ''
    status.value = props.phoneNumber?.status ?? 'active'
    localError.value = ''
    void loadTrunks()
  },
)

function onSubmit() {
  localError.value = ''
  if (!number.value.trim()) {
    localError.value = 'Enter the phone number in E.164 format.'
    return
  }
  if (!sipTrunkId.value) {
    localError.value = 'Select the SIP trunk this number arrives on.'
    return
  }
  if (!name.value.trim()) {
    localError.value = 'Enter a friendly name for this number.'
    return
  }
  emit('submit', {
    number: number.value.trim(),
    sipTrunkId: sipTrunkId.value,
    name: name.value.trim(),
    description: description.value.trim() || undefined,
    status: status.value,
  })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="phone-modal-backdrop" role="presentation" @click.self="emit('cancel')">
      <section class="phone-modal" role="dialog" aria-modal="true" aria-labelledby="phone-modal-title">
        <header class="phone-modal__header">
          <span class="phone-modal__badge">Phone numbers &amp; DIDs</span>
          <button class="phone-modal__close" type="button" aria-label="Close" @click="emit('cancel')">
            <X :size="16" />
          </button>
        </header>

        <div class="phone-modal__intro">
          <h2 id="phone-modal-title">{{ isEdit ? 'Edit phone number' : 'New phone number' }}</h2>
          <p>Register a DID and attach it to a SIP trunk so it can be used as an inbound route source.</p>
        </div>

        <form class="phone-modal__form" @submit.prevent="onSubmit">
          <div class="phone-modal__grid-2">
            <label class="phone-modal__field">
              <span>Number <span style="color:#d17a6d">*</span></span>
              <input v-model="number" type="text" placeholder="+14155550100" required />
            </label>
            <label class="phone-modal__field">
              <span>Status</span>
              <select v-model="status">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>

          <label class="phone-modal__field">
            <span>SIP trunk <span style="color:#d17a6d">*</span></span>
            <select v-model="sipTrunkId" required>
              <option value="" disabled>{{ trunksLoading ? 'Loading…' : 'Select a SIP trunk' }}</option>
              <option v-for="trunk in trunks" :key="trunk.id" :value="trunk.id">{{ trunk.name }}</option>
            </select>
          </label>

          <label class="phone-modal__field">
            <span>Name <span style="color:#d17a6d">*</span></span>
            <input v-model="name" type="text" placeholder="Main Office" required />
          </label>

          <label class="phone-modal__field">
            <span>Description (optional)</span>
            <textarea v-model="description" placeholder="Internal notes about this number" />
          </label>

          <p v-if="localError || error" class="phone-modal__error" role="alert">{{ localError || error }}</p>

          <footer class="phone-modal__footer">
            <button class="button button--secondary" type="button" @click="emit('cancel')">Cancel</button>
            <button class="button button--primary" type="submit" :disabled="submitting">
              {{ submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create phone number' }}
            </button>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>
