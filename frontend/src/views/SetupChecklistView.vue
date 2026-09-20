<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, Check, CircleAlert, LockKeyhole } from 'lucide-vue-next'

const steps = ref([
  { title: 'Confirm tenant profile', detail: 'Set your workspace name and operating timezone.', done: true },
  { title: 'Add people', detail: 'Invite the teammates who need to place or receive calls.', done: true },
  { title: 'Assign extensions', detail: 'Give each person a reachable extension and caller ID.', done: false },
  { title: 'Connect a SIP trunk', detail: 'Add your carrier details before enabling inbound calling.', done: false },
  { title: 'Configure an inbound route', detail: 'Tell CommCare where calls to your main number should go.', done: false },
  { title: 'Add an IVR and recording', detail: 'Optional: give callers a simple menu and welcome message.', done: false },
  { title: 'Test a call', detail: 'Confirm an agent extension and destination can connect.', done: false },
  { title: 'Connect a webhook', detail: 'Optional: send lifecycle events to an external system.', done: false },
])
const completed = computed(() => steps.value.filter((step) => step.done).length)
const progress = computed(() => Math.round((completed.value / steps.value.length) * 100))
function toggle(index: number) { if (index < 2) return; steps.value[index].done = !steps.value[index].done }
</script>

<template>
  <div class="page-enter"><section class="page-heading"><div><p class="eyebrow">Command center</p><h1>Setup checklist</h1><p class="page-heading__copy">A practical path from a new workspace to its first successful call.</p></div></section><section class="setup-layout"><article class="surface setup-summary"><span class="overline">Workspace readiness</span><strong>{{ progress }}%</strong><div class="progress-track"><i :style="{ width: `${progress}%` }" /></div><p>{{ completed }} of {{ steps.length }} steps confirmed by this workspace.</p><div class="setup-warning"><CircleAlert :size="16" /><span>Steps are only considered live after the backend confirms the change.</span></div></article><section class="surface setup-list"><div v-for="(step, index) in steps" :key="step.title" class="setup-step" :class="{ 'setup-step--done': step.done }"><button class="setup-step__check" type="button" :aria-label="`${step.done ? 'Completed' : 'Complete'} ${step.title}`" @click="toggle(index)"><Check v-if="step.done" :size="15" /><LockKeyhole v-else-if="index < 2" :size="14" /></button><div class="setup-step__copy"><strong>{{ step.title }}</strong><p>{{ step.detail }}</p></div><button class="icon-button" type="button" aria-label="Open setup step"><ArrowRight :size="16" /></button></div></section></section></div>
</template>
