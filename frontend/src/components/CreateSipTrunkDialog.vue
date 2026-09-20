<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ open: boolean; submitting?: boolean; error?: string }>()
const emit = defineEmits<{
  cancel: []
  submit: [payload: {
    name: string
    authMode: 'ip' | 'credentials'
    username?: string
    password?: string
    identifyIps?: string[]
    enabled: boolean
  }]
}>()

const name = ref('')
const authMode = ref<'ip' | 'credentials'>('ip')
const username = ref('')
const password = ref('')
const identifyIps = ref('')
const enabled = ref(true)
const localError = ref('')

watch(
  () => props.open,
  (open) => {
    if (!open) return
    name.value = ''
    authMode.value = 'ip'
    username.value = ''
    password.value = ''
    identifyIps.value = ''
    enabled.value = true
    localError.value = ''
  },
)

function onSubmit() {
  localError.value = ''
  if (!name.value.trim()) {
    localError.value = 'Enter a trunk name.'
    return
  }
  if (authMode.value === 'ip') {
    const ips = identifyIps.value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean)
    if (!ips.length) {
      localError.value = 'Add at least one identify IP for IP auth.'
      return
    }
    emit('submit', { name: name.value.trim(), authMode: 'ip', identifyIps: ips, enabled: enabled.value })
    return
  }
  if (!username.value.trim() || !password.value.trim()) {
    localError.value = 'Username and password are required for credentials auth.'
    return
  }
  emit('submit', {
    name: name.value.trim(),
    authMode: 'credentials',
    username: username.value.trim(),
    password: password.value,
    enabled: enabled.value,
  })
}
</script>

<template>
  <div v-if="open" class="dialog-backdrop" role="presentation" @click.self="emit('cancel')">
    <section class="dialog dialog--form" role="dialog" aria-modal="true" aria-label="New SIP trunk">
      <span class="overline">SIP trunks</span>
      <h2>New SIP trunk</h2>
      <p>Create a trunk with IP or credential authentication. Passwords stay write-only.</p>
      <form class="dialog-form" @submit.prevent="onSubmit">
        <label>Name<input v-model="name" type="text" placeholder="Carrier trunk" /></label>
        <label>
          Auth mode
          <select v-model="authMode">
            <option value="ip">IP</option>
            <option value="credentials">Credentials</option>
          </select>
        </label>
        <label v-if="authMode === 'ip'">
          Identify IPs
          <textarea v-model="identifyIps" rows="3" placeholder="13.52.9.100&#10;54.1.2.3" />
        </label>
        <template v-else>
          <label>Username<input v-model="username" type="text" autocomplete="off" /></label>
          <label>Password<input v-model="password" type="password" autocomplete="new-password" /></label>
        </template>
        <label class="check-row"><input v-model="enabled" type="checkbox" /><span>Enabled</span></label>
        <p v-if="localError || error" class="dialer-message dialer-message--error">{{ localError || error }}</p>
        <div class="dialog__actions">
          <button class="button button--secondary" type="button" @click="emit('cancel')">Cancel</button>
          <button class="button button--primary" type="submit" :disabled="submitting">
            {{ submitting ? 'Creating…' : 'Create trunk' }}
          </button>
        </div>
      </form>
    </section>
  </div>
</template>
