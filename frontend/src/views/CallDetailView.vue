<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import RecordingAction from '../components/RecordingAction.vue'
import ResourceState from '../components/ResourceState.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { ApiError } from '../lib/api'
import {
  callParticipant,
  formatCallDuration,
  formatCallTime,
  formatDirectionLabel,
  formatStatusLabel,
  formatWorkflowLabel,
} from '../lib/format/calls'
import { callsService } from '../lib/services/calls.service'
import type { Call } from '../lib/services/types'
import { useSessionStore } from '../stores/session'

type ResourceMode = 'loading' | 'empty' | 'error' | 'forbidden' | 'ready'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const call = ref<Call | null>(null)
const state = ref<ResourceMode>('loading')
const errorMessage = ref('')

const callId = computed(() => String(route.params.id ?? ''))
const participant = computed(() => (call.value ? callParticipant(call.value) : null))

async function loadCall() {
  state.value = 'loading'
  errorMessage.value = ''
  try {
    call.value = await callsService.get(callId.value, session.current?.token ?? '')
    state.value = 'ready'
  } catch (error) {
    call.value = null
    if (error instanceof ApiError && error.status === 403) {
      state.value = 'forbidden'
      errorMessage.value = 'You do not have access to this call.'
      return
    }
    if (error instanceof ApiError && error.status === 404) {
      state.value = 'empty'
      errorMessage.value = 'This call could not be found for the active tenant.'
      return
    }
    state.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : 'Call details could not be loaded.'
  }
}

onMounted(loadCall)
</script>

<template>
  <div class="page-enter">
    <section class="page-heading">
      <div>
        <p class="eyebrow">Calling</p>
        <h1>Call details</h1>
        <p class="page-heading__copy">Inspect participants, timing, status, and recording availability.</p>
      </div>
      <div class="heading-actions">
        <button class="button button--secondary" type="button" @click="router.push('/calls')">
          <ArrowLeft :size="15" /> Back to calls
        </button>
      </div>
    </section>

    <ResourceState
      v-if="state !== 'ready'"
      :state="state"
      :message="errorMessage"
      :retryable="state === 'error'"
      @retry="loadCall"
    />

    <section v-else-if="call" class="surface detail-surface">
      <div class="surface__header">
        <div>
          <span class="overline">{{ formatWorkflowLabel(call.workflow) }}</span>
          <h2>{{ participant?.name }}</h2>
        </div>
        <StatusBadge :status="formatStatusLabel(call.status)" />
      </div>

      <dl class="detail-grid">
        <div><dt>Direction</dt><dd>{{ formatDirectionLabel(call.direction) }}</dd></div>
        <div><dt>Caller</dt><dd>{{ call.callerNumber || '—' }}</dd></div>
        <div><dt>Destination</dt><dd>{{ call.callToNumber || '—' }}</dd></div>
        <div><dt>Agent</dt><dd>{{ call.agentExtension || '—' }}</dd></div>
        <div><dt>Started</dt><dd>{{ formatCallTime(call.startedAt) }}</dd></div>
        <div><dt>Duration</dt><dd>{{ formatCallDuration(call.duration) }}</dd></div>
      </dl>

      <div class="detail-recording">
        <span class="overline">Recording</span>
        <RecordingAction :available="call.recordingAvailable" :url="call.recordingUrl" />
      </div>
    </section>
  </div>
</template>
