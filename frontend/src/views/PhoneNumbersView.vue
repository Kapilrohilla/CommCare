<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Pencil, Plus } from 'lucide-vue-next'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import PhoneNumberDialog from '../components/PhoneNumberDialog.vue'
import ResourceState from '../components/ResourceState.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { ApiError } from '../lib/api'
import { phoneNumbersService, trunksService } from '../lib/services/configuration.service'
import type { PhoneNumber, SipTrunk } from '../lib/services/types'
import { useSessionStore } from '../stores/session'

type ResourceMode = 'loading' | 'empty' | 'error' | 'forbidden' | 'ready'

const session = useSessionStore()
const phoneNumbers = ref<PhoneNumber[]>([])
const trunks = ref<SipTrunk[]>([])
const state = ref<ResourceMode>('loading')
const errorMessage = ref('')
const dialogOpen = ref(false)
const editingNumber = ref<PhoneNumber | null>(null)
const submitting = ref(false)
const dialogError = ref('')
const pendingDelete = ref<PhoneNumber | null>(null)
const token = computed(() => session.current?.token ?? '')

const trunkNameById = computed(() => {
  const map = new Map<string, string>()
  for (const trunk of trunks.value) map.set(trunk.id, trunk.name)
  return map
})

async function loadPhoneNumbers() {
  state.value = 'loading'
  errorMessage.value = ''
  try {
    const [numbers, trunkResult] = await Promise.all([
      phoneNumbersService.list(token.value),
      trunksService.list(token.value).catch(() => []),
    ])
    phoneNumbers.value = numbers
    trunks.value = trunkResult
    state.value = numbers.length ? 'ready' : 'empty'
  } catch (error) {
    phoneNumbers.value = []
    if (error instanceof ApiError && error.status === 403) {
      state.value = 'forbidden'
      errorMessage.value = 'You do not have access to phone numbers.'
      return
    }
    state.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : 'Phone numbers could not be loaded.'
  }
}

function openCreate() {
  editingNumber.value = null
  dialogError.value = ''
  dialogOpen.value = true
}

function openEdit(phoneNumber: PhoneNumber) {
  editingNumber.value = phoneNumber
  dialogError.value = ''
  dialogOpen.value = true
}

async function submitPhoneNumber(payload: {
  number: string
  sipTrunkId: string
  name: string
  description?: string
  status: 'active' | 'inactive'
}) {
  submitting.value = true
  dialogError.value = ''
  try {
    if (editingNumber.value) {
      await phoneNumbersService.update(editingNumber.value.id, payload, token.value)
    } else {
      await phoneNumbersService.create(payload, token.value)
    }
    dialogOpen.value = false
    await loadPhoneNumbers()
  } catch (error) {
    dialogError.value = error instanceof Error ? error.message : 'Phone number could not be saved.'
  } finally {
    submitting.value = false
  }
}

async function deletePhoneNumber() {
  if (!pendingDelete.value) return
  try {
    await phoneNumbersService.remove(pendingDelete.value.id, token.value)
    pendingDelete.value = null
    await loadPhoneNumbers()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Could not delete phone number.'
    state.value = 'error'
    pendingDelete.value = null
  }
}

onMounted(loadPhoneNumbers)
</script>

<template>
  <div class="page-enter">
    <section class="page-heading">
      <div>
        <p class="eyebrow">Configuration</p>
        <h1>Phone numbers</h1>
        <p class="page-heading__copy">Register DIDs and attach them to a SIP trunk for use as inbound route sources.</p>
      </div>
      <div class="heading-actions">
        <button class="button button--primary" type="button" @click="openCreate">
          <Plus :size="15" /> New phone number
        </button>
      </div>
    </section>

    <ResourceState
      v-if="state === 'loading' || state === 'error' || state === 'forbidden'"
      :state="state"
      :message="errorMessage"
      :retryable="state === 'error'"
      @retry="loadPhoneNumbers"
    />

    <section v-else class="surface table-surface">
      <div class="table-scroll">
        <table v-if="state !== 'empty'">
          <thead>
            <tr>
              <th>Number</th>
              <th>Name</th>
              <th>SIP trunk</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="phoneNumber in phoneNumbers" :key="phoneNumber.id">
              <td><strong>{{ phoneNumber.number }}</strong></td>
              <td>
                {{ phoneNumber.name }}
                <template v-if="phoneNumber.description"><br /><small>{{ phoneNumber.description }}</small></template>
              </td>
              <td>{{ trunkNameById.get(phoneNumber.sipTrunkId) || '—' }}</td>
              <td><StatusBadge :status="phoneNumber.status" /></td>
              <td class="table-actions">
                <button class="button button--secondary button--compact" type="button" @click="openEdit(phoneNumber)">
                  <Pencil :size="13" /> Edit
                </button>
                <button class="button button--secondary button--compact" type="button" @click="pendingDelete = phoneNumber">
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <ResourceState v-if="state === 'empty'" state="empty" title="No phone numbers" message="Register a DID to start routing inbound calls." />
      </div>
    </section>

    <PhoneNumberDialog
      :open="dialogOpen"
      :phone-number="editingNumber"
      :submitting="submitting"
      :error="dialogError"
      @cancel="dialogOpen = false"
      @submit="submitPhoneNumber"
    />
    <ConfirmDialog
      :open="Boolean(pendingDelete)"
      title="Delete phone number?"
      message="This removes the number after the backend confirms it is not referenced by an inbound route."
      confirm-label="Delete number"
      @cancel="pendingDelete = null"
      @confirm="deletePhoneNumber"
    />
  </div>
</template>
