<script setup lang="ts">
import { computed, ref } from 'vue'
import { Filter, MoreHorizontal, Search } from 'lucide-vue-next'
import StatusBadge from '../components/StatusBadge.vue'

const query = ref('')
const filter = ref('All')
const calls = [
  { id: 'call-1', name: 'Maya Chen', number: '+1 415 555 0138', direction: 'Inbound', workflow: 'Inbound route', time: '09:42 AM', duration: '04:18', status: 'Connected' },
  { id: 'call-2', name: 'Liam Patel', number: '+1 628 555 0192', direction: 'Outbound', workflow: 'Click to call', time: '09:18 AM', duration: '02:46', status: 'Connected' },
  { id: 'call-3', name: 'Emma Wilson', number: '+1 510 555 0144', direction: 'Outbound', workflow: 'Click to call', time: '08:56 AM', duration: '—', status: 'No answer' },
  { id: 'call-4', name: 'Noah Ortiz', number: '+1 415 555 0108', direction: 'Inbound', workflow: 'IVR', time: '08:41 AM', duration: '07:12', status: 'Completed' },
]
const filteredCalls = computed(() => calls.filter((call) => (filter.value === 'All' || call.direction === filter.value) && `${call.name} ${call.number}`.toLowerCase().includes(query.value.toLowerCase())))
</script>

<template>
  <div class="page-enter"><section class="page-heading"><div><p class="eyebrow">Calling</p><h1>Calls</h1><p class="page-heading__copy">A dense, searchable view of conversations across the tenant.</p></div></section><section class="surface table-surface"><div class="surface__header table-header"><div><span class="overline">Today</span><h2>Call activity</h2></div><div class="table-tools"><div class="mini-search"><Search :size="15" /><input v-model="query" placeholder="Search calls" /></div><button class="button button--secondary"><Filter :size="15" /> Filters</button></div></div><div class="tabs"><button v-for="option in ['All', 'Inbound', 'Outbound']" :key="option" :class="{ 'tab--active': filter === option }" @click="filter = option">{{ option }}</button></div><div class="table-scroll"><table><thead><tr><th>Contact</th><th>Direction</th><th>Workflow</th><th>Time</th><th>Duration</th><th>Status</th><th /></tr></thead><tbody><tr v-for="call in filteredCalls" :key="call.id"><td><div class="table-person"><span class="person-avatar person-avatar--blue">{{ call.name.split(' ').map((part) => part[0]).join('') }}</span><span><strong>{{ call.name }}</strong><small>{{ call.number }}</small></span></div></td><td>{{ call.direction }}</td><td>{{ call.workflow }}</td><td>{{ call.time }}</td><td>{{ call.duration }}</td><td><StatusBadge :status="call.status" /></td><td><button class="icon-button" aria-label="More call actions"><MoreHorizontal :size="17" /></button></td></tr></tbody></table><div v-if="!filteredCalls.length" class="empty-state"><Search :size="22" /><strong>No calls found</strong><p>Try a different search or direction filter.</p></div></div></section></div>
</template>
