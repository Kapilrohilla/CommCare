<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { PhoneCall, Signal, UserRound } from 'lucide-vue-next'
import { ApiError } from '../lib/api'
import { formatStatusLabel } from '../lib/format/calls'
import { callsService } from '../lib/services/calls.service'
import { tenancyService } from '../lib/services/tenancy.service'
import type { Call, Extension } from '../lib/services/types'
import { useSessionStore } from '../stores/session'

type DialerState = 'idle' | 'pending' | 'active' | 'completed' | 'failed'

const session = useSessionStore()
const extensions = ref<Extension[]>([])
const extension = ref('')
const destination = ref('')
const mode = ref<'internal' | 'external'>('external')
const state = ref<DialerState>('idle')
const message = ref('')
const fieldError = ref('')
const activeCall = ref<Call | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

const submitting = computed(() => state.value === 'pending')
const stateLabel = computed(() => ({
  idle: 'Ready to call',
  pending: 'Connecting…',
  active: 'Call active',
  completed: 'Call completed',
  failed: 'Call failed',
}[state.value]))
const statusTone = computed(() => (state.value === 'failed' ? 'status-pill--warn' : 'status-pill--good'))
const extensionOptions = computed(() => {
  if (extensions.value.length) return extensions.value
  return [
    { id: 'demo-201', extension: '201', status: 'available', callerIdName: 'Maya Chen' },
    { id: 'demo-204', extension: '204', status: 'available', callerIdName: 'Liam Patel' },
  ] as Extension[]
})
const selectedExtension = computed(() =>
  extensionOptions.value.find((item) => item.extension === extension.value) ?? extensionOptions.value[0],
)

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function mapBackendStatus(status?: string | null): DialerState {
  const normalized = (status ?? '').toLowerCase()
  if (['completed'].includes(normalized)) return 'completed'
  if (['failed', 'busy', 'no_answer', 'cancelled', 'unavailable', 'rejected'].includes(normalized)) return 'failed'
  if (['answered', 'ringing', 'originating', 'initiated'].includes(normalized)) return 'active'
  return 'active'
}

async function refreshCall(callId: string) {
  try {
    const call = await callsService.get(callId, session.current?.token ?? '')
    activeCall.value = call
    const next = mapBackendStatus(call.status)
    state.value = next
    message.value = `Backend status: ${formatStatusLabel(call.status)}.`
    if (next === 'completed' || next === 'failed') stopPolling()
  } catch {
    // Keep the last confirmed acceptance state if refresh fails transiently.
  }
}

function startPolling(callId: string) {
  stopPolling()
  void refreshCall(callId)
  pollTimer = setInterval(() => {
    void refreshCall(callId)
  }, 2500)
}

function validateDestination(): string | null {
  const value = destination.value.trim()
  if (!value) return 'Enter a phone number or extension.'
  if (mode.value === 'internal') {
    if (!/^\d{2,8}$/.test(value)) return 'Internal destinations must be a 2–8 digit extension.'
    if (value === extension.value) return 'Choose a different extension than the agent leg.'
    return null
  }
  const digits = value.replace(/\D/g, '')
  if (digits.length < 7) return 'Enter a valid external phone number.'
  return null
}

async function loadExtensions() {
  try {
    const list = await tenancyService.extensions(session.current?.token ?? '')
    extensions.value = list
    if (!extension.value && list[0]?.extension) extension.value = list[0].extension
  } catch {
    if (!extension.value) extension.value = extensionOptions.value[0]?.extension ?? '201'
  }
}

async function placeCall() {
  if (submitting.value) return
  fieldError.value = validateDestination() ?? ''
  if (fieldError.value) {
    state.value = 'failed'
    message.value = fieldError.value
    return
  }

  state.value = 'pending'
  message.value = ''
  activeCall.value = null
  stopPolling()

  try {
    const call = await callsService.clickToCall(
      {
        fromNumber: selectedExtension.value?.extension ?? extension.value,
        toNumber: destination.value.trim(),
        type: mode.value,
      },
      session.current?.token ?? '',
    )
    activeCall.value = call
    state.value = mapBackendStatus(call.status)
    if (state.value === 'failed') {
      message.value = `Call ended as ${formatStatusLabel(call.status)}.`
      return
    }
    message.value = 'The backend accepted the call. Refreshing confirmed status…'
    if (call.id) startPolling(call.id)
  } catch (error) {
    state.value = 'failed'
    if (error instanceof ApiError) {
      message.value = error.message
      return
    }
    message.value = error instanceof Error ? error.message : 'The call could not be started.'
  }
}

onMounted(() => {
  if (!extension.value) extension.value = '201'
  void loadExtensions()
})
onUnmounted(stopPolling)
</script>

<template>
  <div class="page-enter">
    <section class="page-heading">
      <div>
        <p class="eyebrow">Calling</p>
        <h1>Dialer</h1>
        <p class="page-heading__copy">A focused place to start internal and external calls.</p>
      </div>
    </section>

    <section class="dialer-layout">
      <article class="surface dialer-card">
        <div class="surface__header">
          <div>
            <span class="overline">Place a call</span>
            <h2>Connect someone</h2>
          </div>
          <span class="status-pill" :class="statusTone">{{ stateLabel }}</span>
        </div>

        <form class="dialer-form" @submit.prevent="placeCall">
          <label>
            From extension
            <select v-model="extension">
              <option v-for="item in extensionOptions" :key="item.id || item.extension" :value="item.extension">
                {{ item.extension }}{{ item.callerIdName || item.userInfo?.name ? ` · ${item.callerIdName || item.userInfo?.name}` : '' }}
              </option>
            </select>
          </label>

          <div class="mode-toggle">
            <button
              v-for="option in (['internal', 'external'] as const)"
              :key="option"
              type="button"
              :class="{ 'mode-toggle__active': mode === option }"
              @click="mode = option"
            >
              {{ option === 'internal' ? 'Internal extension' : 'External number' }}
            </button>
          </div>

          <label>
            Destination
            <span class="field">
              <PhoneCall :size="16" />
              <input
                v-model="destination"
                :placeholder="mode === 'internal' ? 'e.g. 204' : '+1 415 555 0138'"
                :aria-invalid="Boolean(fieldError)"
              />
            </span>
          </label>

          <div class="caller-preview">
            <UserRound :size="16" />
            <span>
              <small>Caller ID preview</small>
              <strong>
                Extension {{ selectedExtension?.extension ?? extension }}
                · {{ selectedExtension?.callerIdName || session.current?.tenant || 'CommCare' }}
              </strong>
            </span>
          </div>

          <button class="button button--primary button--wide" type="submit" :disabled="submitting">
            <PhoneCall :size="16" />
            {{ submitting ? 'Connecting...' : 'Place call' }}
          </button>

          <p v-if="message" class="dialer-message" :class="{ 'dialer-message--error': state === 'failed' }">
            {{ message }}
          </p>

          <p v-if="activeCall" class="dialer-message">
            Call {{ activeCall.id }} · {{ formatStatusLabel(activeCall.status) }}
          </p>
        </form>
      </article>

      <aside class="surface dialer-help">
        <Signal :size="20" />
        <span class="overline">How it works</span>
        <h2>Two legs, one conversation.</h2>
        <p>
          CommCare rings your selected extension first. Once answered, it connects the destination and keeps the live
          call state from backend-confirmed updates.
        </p>
        <div class="dialer-steps">
          <span><b>01</b> Agent leg</span>
          <span><b>02</b> Destination leg</span>
          <span><b>03</b> Connected</span>
        </div>
      </aside>
    </section>
  </div>
</template>
