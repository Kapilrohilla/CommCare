<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Filter, MoreHorizontal, Search } from 'lucide-vue-next'
import RecordingAction from '../components/RecordingAction.vue'
import ResourceState from '../components/ResourceState.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { ApiError } from '../lib/api'
import {
  callInitials,
  callParticipant,
  formatCallDuration,
  formatCallTime,
  formatDirectionLabel,
  formatStatusLabel,
  formatWorkflowLabel,
} from '../lib/format/calls'
import { callsService } from '../lib/services/calls.service'
import type { Call, CallDirection } from '../lib/services/types'
import { useSessionStore } from '../stores/session'

type ResourceMode = 'loading' | 'empty' | 'error' | 'forbidden' | 'ready'
type DirectionFilter = 'All' | 'Inbound' | 'Outbound' | 'Internal'

const session = useSessionStore()
const router = useRouter()
const query = ref('')
const filter = ref<DirectionFilter>('All')
const calls = ref<Call[]>([])
const total = ref(0)
const state = ref<ResourceMode>('loading')
const errorMessage = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const directionParam = computed<CallDirection | undefined>(() => {
  if (filter.value === 'Inbound') return 'inbound'
  if (filter.value === 'Outbound') return 'outbound'
  if (filter.value === 'Internal') return 'internal'
  return undefined
})

async function loadCalls() {
  state.value = 'loading'
  errorMessage.value = ''
  try {
    const response = await callsService.list(
      {
        direction: directionParam.value,
        number: query.value.trim() || undefined,
        limit: 50,
        offset: 0,
      },
      session.current?.token ?? '',
    )
    calls.value = response.items
    total.value = response.total
    state.value = response.items.length ? 'ready' : 'empty'
  } catch (error) {
    calls.value = []
    total.value = 0
    if (error instanceof ApiError && error.status === 403) {
      state.value = 'forbidden'
      errorMessage.value = 'You do not have access to call activity.'
      return
    }
    state.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : 'Call activity could not be loaded.'
  }
}

function scheduleLoad() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(loadCalls, 250)
}

function openCall(id: string) {
  void router.push(`/calls/${id}`)
}

onMounted(loadCalls)
watch([filter], loadCalls)
watch(query, scheduleLoad)
</script>

<template>
  <div class="page-enter">
    <section class="page-heading">
      <div>
        <p class="eyebrow">Calling</p>
        <h1>Calls</h1>
        <p class="page-heading__copy">A dense, searchable view of conversations across the tenant.</p>
      </div>
    </section>

    <section class="surface table-surface">
      <div class="surface__header table-header">
        <div>
          <span class="overline">Activity</span>
          <h2>Call activity</h2>
        </div>
        <div class="table-tools">
          <div class="mini-search">
            <Search :size="15" />
            <input v-model="query" placeholder="Search number or extension" />
          </div>
          <button class="button button--secondary" type="button" disabled title="Advanced filters coming soon">
            <Filter :size="15" /> Filters
          </button>
        </div>
      </div>

      <div class="tabs">
        <button
          v-for="option in (['All', 'Inbound', 'Outbound', 'Internal'] as DirectionFilter[])"
          :key="option"
          type="button"
          :class="{ 'tab--active': filter === option }"
          @click="filter = option"
        >
          {{ option }}
        </button>
      </div>

      <ResourceState
        v-if="state === 'loading' || state === 'error' || state === 'forbidden'"
        :state="state"
        :message="errorMessage"
        :retryable="state === 'error'"
        @retry="loadCalls"
      />

      <div v-else class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Contact</th>
              <th>Direction</th>
              <th>Workflow</th>
              <th>Time</th>
              <th>Duration</th>
              <th>Recording</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="call in calls"
              :key="call.id"
              class="table-row--clickable"
              @click="openCall(call.id)"
            >
              <td>
                <div class="table-person">
                  <span class="person-avatar person-avatar--blue">{{ callInitials(callParticipant(call).name) }}</span>
                  <span>
                    <strong>{{ callParticipant(call).name }}</strong>
                    <small>{{ callParticipant(call).number }}</small>
                  </span>
                </div>
              </td>
              <td>{{ formatDirectionLabel(call.direction) }}</td>
              <td>{{ formatWorkflowLabel(call.workflow) }}</td>
              <td>{{ formatCallTime(call.startedAt) }}</td>
              <td>{{ formatCallDuration(call.duration) }}</td>
              <td @click.stop>
                <RecordingAction :available="call.recordingAvailable" :url="call.recordingUrl" />
              </td>
              <td><StatusBadge :status="formatStatusLabel(call.status)" /></td>
              <td>
                <button class="icon-button" type="button" aria-label="Open call detail" @click.stop="openCall(call.id)">
                  <MoreHorizontal :size="17" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <ResourceState
          v-if="state === 'empty'"
          state="empty"
          title="No calls found"
          message="Try a different search or direction filter."
        />

        <p v-else class="table-meta">Showing {{ calls.length }} of {{ total }} calls</p>
      </div>
    </section>
  </div>
</template>
