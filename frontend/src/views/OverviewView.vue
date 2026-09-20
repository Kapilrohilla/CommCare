<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowUpRight, CheckCircle2, Clock3, PhoneCall, Signal, Users, XCircle } from 'lucide-vue-next'
import ResourceState from '../components/ResourceState.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { ApiError } from '../lib/api'
import {
  callInitials,
  callParticipant,
  formatCallTime,
  formatDirectionLabel,
  formatStatusLabel,
  formatTalkTime,
} from '../lib/format/calls'
import { callsService } from '../lib/services/calls.service'
import type { Call, DashboardMetrics } from '../lib/services/types'
import { useSessionStore } from '../stores/session'

type ResourceMode = 'loading' | 'empty' | 'error' | 'forbidden' | 'ready'

const session = useSessionStore()
const state = ref<ResourceMode>('loading')
const errorMessage = ref('')
const metrics = ref<DashboardMetrics | null>(null)

const metricCards = computed(() => {
  const data = metrics.value
  return [
    {
      label: 'Calls today',
      value: data ? String(data.callsToday.total) : '—',
      detail: data ? 'UTC day so far' : 'Unavailable',
      icon: PhoneCall,
      tone: 'amber',
    },
    {
      label: 'Talk time',
      value: data ? formatTalkTime(data.talkTimeSeconds) : '—',
      detail: 'Completed duration',
      icon: Clock3,
      tone: 'blue',
    },
    {
      label: 'Missed calls',
      value: data ? String(data.missedCalls).padStart(2, '0') : '—',
      detail: 'No answer, busy, cancelled',
      icon: XCircle,
      tone: 'coral',
    },
    {
      label: 'Active users',
      value: data?.extensions
        ? `${data.extensions.assigned} / ${data.extensions.total}`
        : '—',
      detail: data?.extensions ? 'Assigned extensions' : 'Unavailable',
      icon: Users,
      tone: 'green',
    },
  ]
})

const recentCalls = computed(() => metrics.value?.recentCalls ?? [])
const asOfLabel = computed(() => {
  if (!metrics.value?.asOf) return 'Not refreshed yet'
  const date = new Date(metrics.value.asOf)
  return Number.isNaN(date.getTime())
    ? 'Not refreshed yet'
    : `Last refreshed ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
})
const headingDate = new Date().toLocaleDateString(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

async function loadDashboard() {
  state.value = 'loading'
  errorMessage.value = ''
  try {
    metrics.value = await callsService.dashboard(session.current?.token ?? '')
    state.value = recentCalls.value.length || metrics.value.callsToday.total > 0 ? 'ready' : 'empty'
  } catch (error) {
    metrics.value = null
    if (error instanceof ApiError && error.status === 403) {
      state.value = 'forbidden'
      errorMessage.value = 'You do not have access to tenant call metrics.'
      return
    }
    state.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : 'Dashboard metrics could not be loaded.'
  }
}

function activityLabel(call: Call) {
  const participant = callParticipant(call)
  return {
    initials: callInitials(participant.name),
    name: participant.name,
    detail: `${formatDirectionLabel(call.direction)} · ${formatCallTime(call.startedAt)}`,
    status: formatStatusLabel(call.status),
  }
}

onMounted(loadDashboard)
</script>

<template>
  <div class="page-enter">
    <section class="page-heading">
      <div>
        <p class="eyebrow">{{ headingDate }}</p>
        <h1>Overview</h1>
        <p class="page-heading__copy">
          Good morning{{ session.current?.user ? `, ${session.current.user}` : '' }}. Here is what is happening across your workspace.
        </p>
      </div>
      <div class="heading-actions">
        <button class="button button--secondary" type="button" disabled title="Export is not available yet">Export</button>
        <RouterLink class="button button--primary" to="/dialer"><PhoneCall :size="15" /> Place a call</RouterLink>
      </div>
    </section>

    <ResourceState
      v-if="state !== 'ready' && state !== 'empty'"
      :state="state"
      :message="errorMessage"
      :retryable="state === 'error'"
      @retry="loadDashboard"
    />

    <template v-else>
      <section class="signal-banner">
        <div class="signal-banner__icon"><Signal :size="20" /></div>
        <div>
          <strong>Tenant call activity</strong>
          <p>{{ asOfLabel }}. Metrics come from backend-confirmed call records only.</p>
        </div>
        <button class="icon-button" type="button" aria-label="Refresh dashboard" @click="loadDashboard">
          <CheckCircle2 :size="16" />
        </button>
      </section>

      <section class="metric-grid">
        <article
          v-for="metric in metricCards"
          :key="metric.label"
          class="metric-card"
          :class="`metric-card--${metric.tone}`"
        >
          <div class="metric-card__top">
            <span>{{ metric.label }}</span>
            <component :is="metric.icon" :size="17" />
          </div>
          <strong>{{ metric.value }}</strong>
          <span class="metric-card__trend"><small>{{ metric.detail }}</small></span>
        </article>
      </section>

      <section class="dashboard-grid">
        <article class="surface activity-surface activity-surface--wide">
          <div class="surface__header">
            <div>
              <span class="overline">Live feed</span>
              <h2>Recent activity</h2>
            </div>
            <RouterLink to="/calls" class="text-link">View all <ArrowUpRight :size="14" /></RouterLink>
          </div>

          <ResourceState
            v-if="state === 'empty'"
            state="empty"
            title="No calls yet today"
            message="Place a call or wait for inbound activity to populate this feed."
          />

          <div v-else class="activity-list">
            <RouterLink
              v-for="call in recentCalls"
              :key="call.id"
              class="activity-row activity-row--link"
              :to="`/calls/${call.id}`"
            >
              <span class="person-avatar person-avatar--blue">{{ activityLabel(call).initials }}</span>
              <div>
                <strong>{{ activityLabel(call).name }}</strong>
                <p>{{ activityLabel(call).detail }}</p>
              </div>
              <StatusBadge :status="activityLabel(call).status" />
            </RouterLink>
          </div>
        </article>
      </section>
    </template>
  </div>
</template>
