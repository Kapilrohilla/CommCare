<script setup lang="ts">
import { ArrowUpRight, CheckCircle2, Clock3, PhoneCall, Signal, Users, XCircle } from 'lucide-vue-next'

const metrics = [
  { label: 'Calls today', value: '148', trend: '+12.8%', icon: PhoneCall, tone: 'amber' },
  { label: 'Talk time', value: '18h 42m', trend: '+8.4%', icon: Clock3, tone: 'blue' },
  { label: 'Missed calls', value: '07', trend: '-4.1%', icon: XCircle, tone: 'coral' },
  { label: 'Active users', value: '24 / 28', trend: '85.7%', icon: Users, tone: 'green' },
]
const activity = [
  { initials: 'MC', name: 'Maya Chen', detail: 'Inbound call · 09:42 AM', status: 'Connected', color: 'coral' },
  { initials: 'LP', name: 'Liam Patel', detail: 'Outbound call · 09:18 AM', status: 'Connected', color: 'blue' },
  { initials: 'EW', name: 'Emma Wilson', detail: 'Outbound call · 08:56 AM', status: 'Missed', color: 'gold' },
  { initials: 'NO', name: 'Noah Ortiz', detail: 'Inbound call · 08:41 AM', status: 'Connected', color: 'green' },
]
</script>

<template>
  <div class="page-enter"><section class="page-heading"><div><p class="eyebrow">Tuesday, September 20, 2026</p><h1>Overview</h1><p class="page-heading__copy">Good morning, Jordan. Here is what is happening across your workspace.</p></div><div class="heading-actions"><button class="button button--secondary">Export</button><button class="button button--primary"><PhoneCall :size="15" /> Place a call</button></div></section><section class="signal-banner"><div class="signal-banner__icon"><Signal :size="20" /></div><div><strong>Your calling system is healthy</strong><p>All 12 services are online. Last checked 2 minutes ago.</p></div><button class="icon-button"><CheckCircle2 :size="16" /></button></section><section class="metric-grid"><article v-for="metric in metrics" :key="metric.label" class="metric-card" :class="`metric-card--${metric.tone}`"><div class="metric-card__top"><span>{{ metric.label }}</span><component :is="metric.icon" :size="17" /></div><strong>{{ metric.value }}</strong><span class="metric-card__trend">{{ metric.trend }} <small>{{ metric.label === 'Active users' ? 'availability' : 'vs yesterday' }}</small></span><div class="progress-track"><i :style="{ width: metric.label === 'Active users' ? '85.7%' : '68%' }" /></div></article></section><section class="dashboard-grid"><article class="surface chart-surface"><div class="surface__header"><div><span class="overline">Volume</span><h2>Call traffic</h2></div><span class="status-pill status-pill--good">Live feed</span></div><div class="chart-legend"><span><i class="legend-dot legend-dot--amber" />Inbound</span><span><i class="legend-dot legend-dot--blue" />Outbound</span></div><div class="chart"><div class="chart__y"><span>60</span><span>40</span><span>20</span><span>0</span></div><div class="chart__plot"><i class="chart-line chart-line--amber" /><i class="chart-line chart-line--blue" /><div class="chart__grid" /><div class="chart__x"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></div></div></article><article class="surface activity-surface"><div class="surface__header"><div><span class="overline">Live feed</span><h2>Recent activity</h2></div><a href="/calls" class="text-link">View all <ArrowUpRight :size="14" /></a></div><div class="activity-list"><div v-for="item in activity" :key="item.name" class="activity-row"><span class="person-avatar" :class="`person-avatar--${item.color}`">{{ item.initials }}</span><div><strong>{{ item.name }}</strong><p>{{ item.detail }}</p></div><span class="status-pill" :class="item.status === 'Missed' ? 'status-pill--warn' : 'status-pill--good'">{{ item.status }}</span></div></div></article></section></div>
</template>
