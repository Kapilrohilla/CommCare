<script setup lang="ts">
import { computed, ref } from 'vue'
import { PhoneCall, Signal, UserRound } from 'lucide-vue-next'
import { callsService } from '../lib/services/calls.service'
import { useSessionStore } from '../stores/session'

const session = useSessionStore()
const extension = ref('201')
const destination = ref('')
const mode = ref<'internal' | 'external'>('external')
const state = ref<'idle' | 'starting' | 'connected' | 'failed'>('idle')
const message = ref('')
const stateLabel = computed(() => ({ idle: 'Ready to call', starting: 'Connecting agent', connected: 'Call started', failed: 'Call failed' })[state.value])

async function placeCall() {
  if (!destination.value.trim()) { state.value = 'failed'; message.value = 'Enter a phone number or extension.'; return }
  state.value = 'starting'; message.value = ''
  try {
    await callsService.clickToCall({ fromNumber: extension.value, toNumber: destination.value.trim(), type: mode.value }, session.current?.token ?? '')
    state.value = 'connected'; message.value = 'The backend accepted the call. Keep this screen open for status updates.'
  } catch (error) {
    state.value = 'failed'; message.value = error instanceof Error ? error.message : 'The call could not be started.'
  }
}
</script>

<template>
  <div class="page-enter"><section class="page-heading"><div><p class="eyebrow">Calling</p><h1>Dialer</h1><p class="page-heading__copy">A focused place to start internal and external calls.</p></div></section><section class="dialer-layout"><article class="surface dialer-card"><div class="surface__header"><div><span class="overline">Place a call</span><h2>Connect someone</h2></div><span class="status-pill" :class="state === 'failed' ? 'status-pill--warn' : 'status-pill--good'">{{ stateLabel }}</span></div><form class="dialer-form" @submit.prevent="placeCall"><label>From extension<select v-model="extension"><option value="201">201 · Maya Chen</option><option value="204">204 · Liam Patel</option></select></label><div class="mode-toggle"><button v-for="option in ['internal', 'external']" :key="option" type="button" :class="{ 'mode-toggle__active': mode === option }" @click="mode = option as 'internal' | 'external'">{{ option === 'internal' ? 'Internal extension' : 'External number' }}</button></div><label>Destination<span class="field"><PhoneCall :size="16" /><input v-model="destination" :placeholder="mode === 'internal' ? 'e.g. 204' : '+1 415 555 0138'" /></span></label><div class="caller-preview"><UserRound :size="16" /><span><small>Caller ID preview</small><strong>Extension {{ extension }} · Atlas Field Ops</strong></span></div><button class="button button--primary button--wide" type="submit" :disabled="state === 'starting'"><PhoneCall :size="16" />{{ state === 'starting' ? 'Connecting...' : 'Place call' }}</button><p v-if="message" class="dialer-message" :class="{ 'dialer-message--error': state === 'failed' }">{{ message }}</p></form></article><aside class="surface dialer-help"><Signal :size="20" /><span class="overline">How it works</span><h2>Two legs, one conversation.</h2><p>CommCare rings your selected extension first. Once answered, it connects the destination and keeps the live call state in the activity feed.</p><div class="dialer-steps"><span><b>01</b> Agent leg</span><span><b>02</b> Destination leg</span><span><b>03</b> Connected</span></div></aside></section></div>
</template>
