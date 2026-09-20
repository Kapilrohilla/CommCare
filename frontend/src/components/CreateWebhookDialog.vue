<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Lock, Plus, ShieldCheck, X } from 'lucide-vue-next'

const props = defineProps<{ open: boolean; submitting?: boolean; error?: string }>()
const emit = defineEmits<{
  cancel: []
  submit: [payload: { name: string; description?: string; endpoint: string; method: string; triggerEvent: string }]
}>()

const TRIGGER_OPTIONS = [
  { value: 'Click2Call.CalleeConnected', label: 'Click2Call.CalleeConnected — Target party answers call' },
  { value: 'Click2Call.CalleeDisconnected', label: 'Click2Call.CalleeDisconnected — Target party hangs up' },
  { value: 'Click2Call.CallerConnected', label: 'Click2Call.CallerConnected — Originating party answers' },
  { value: 'Click2Call.CallerDisconnected', label: 'Click2Call.CallerDisconnected — Originating party hangs up' },
  { value: 'Click2Call.CallerNoAnswer', label: 'Click2Call.CallerNoAnswer — Originating party does not answer' },
  { value: 'Click2Call.CalleeNoAnswer', label: 'Click2Call.CalleeNoAnswer — Target party does not answer' },
] as const

const name = ref('')
const description = ref('')
const endpoint = ref('')
const method = ref('post')
const triggerEvent = ref('Click2Call.CalleeConnected')
const localError = ref('')

const endpointLooksSecure = computed(() => /^https:\/\//i.test(endpoint.value.trim()))

watch(
  () => props.open,
  (open) => {
    if (!open) return
    name.value = ''
    description.value = ''
    endpoint.value = ''
    method.value = 'post'
    triggerEvent.value = 'Click2Call.CalleeConnected'
    localError.value = ''
  },
)

function onSubmit() {
  localError.value = ''
  if (!name.value.trim() || !endpoint.value.trim()) {
    localError.value = 'Name and endpoint URL are required.'
    return
  }
  if (!endpointLooksSecure.value) {
    localError.value = 'Endpoint URL must use HTTPS.'
    return
  }
  emit('submit', {
    name: name.value.trim(),
    description: description.value.trim() || undefined,
    endpoint: endpoint.value.trim(),
    method: method.value,
    triggerEvent: triggerEvent.value,
  })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="webhook-modal-backdrop" role="presentation" @click.self="emit('cancel')">
      <section class="webhook-modal" role="dialog" aria-modal="true" aria-labelledby="webhook-modal-title">
        <header class="webhook-modal__header">
          <div class="webhook-modal__tags">
            <span class="webhook-modal__badge">Webhooks engine</span>
            <span class="webhook-modal__meta">PBX Outbound Dispatcher</span>
          </div>
          <button class="webhook-modal__close" type="button" aria-label="Close" @click="emit('cancel')">
            <X :size="16" />
          </button>
        </header>

        <div class="webhook-modal__intro">
          <h2 id="webhook-modal-title">New webhook</h2>
          <p>Register an HTTPS endpoint for call lifecycle events. Secrets are never shown in the table.</p>
        </div>

        <form class="webhook-modal__form" @submit.prevent="onSubmit">
          <div class="webhook-modal__field">
            <div class="webhook-modal__label-row">
              <label for="webhook-name">Name <span aria-hidden="true">*</span></label>
              <span class="webhook-modal__hint">Internal reference tag</span>
            </div>
            <input id="webhook-name" v-model="name" type="text" placeholder="CRM sync" required />
          </div>

          <div class="webhook-modal__field">
            <label for="webhook-description">Description <span class="webhook-modal__optional">(Optional)</span></label>
            <input
              id="webhook-description"
              v-model="description"
              type="text"
              placeholder="e.g. Pushes customer phone metadata to external warehouse"
            />
          </div>

          <div class="webhook-modal__field">
            <div class="webhook-modal__label-row">
              <label for="webhook-endpoint">Endpoint URL <span aria-hidden="true">*</span></label>
              <span class="webhook-modal__secure" :class="{ 'is-ok': endpointLooksSecure }">
                <Lock :size="12" aria-hidden="true" />
                TLS 1.2+ required
              </span>
            </div>
            <div class="webhook-modal__endpoint">
              <span class="webhook-modal__method" aria-hidden="true">{{ method.toUpperCase() }}</span>
              <input
                id="webhook-endpoint"
                v-model="endpoint"
                type="url"
                placeholder="https://example.com/hooks/calls"
                required
              />
            </div>
            <p class="webhook-modal__helper">Must accept JSON payloads and return an HTTP 2xx response within 10 seconds.</p>
          </div>

          <div class="webhook-modal__field">
            <div class="webhook-modal__label-row">
              <label for="webhook-trigger">Trigger event <span aria-hidden="true">*</span></label>
              <a class="webhook-modal__schema" href="#" @click.prevent>View JSON schema</a>
            </div>
            <select id="webhook-trigger" v-model="triggerEvent" required>
              <option v-for="option in TRIGGER_OPTIONS" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>

          <aside class="webhook-modal__notice">
            <ShieldCheck :size="16" aria-hidden="true" />
            <p>
              <strong>Automatic HMAC-SHA256 Signing:</strong>
              Every delivery includes an
              <code>X-CommCare-Signature</code>
              header calculated using your workspace primary secret.
            </p>
          </aside>

          <p v-if="localError || error" class="webhook-modal__error" role="alert">{{ localError || error }}</p>

          <footer class="webhook-modal__footer">
            <span class="webhook-modal__status">
              <span class="webhook-modal__status-dot" aria-hidden="true" />
              Gateway dispatcher ready
            </span>
            <div class="webhook-modal__actions">
              <button class="button button--secondary" type="button" @click="emit('cancel')">Cancel</button>
              <button class="button button--primary" type="submit" :disabled="submitting">
                <Plus :size="14" aria-hidden="true" />
                {{ submitting ? 'Creating…' : 'Create webhook' }}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>
