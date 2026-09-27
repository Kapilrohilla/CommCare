<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Component } from 'vue'
import {
  Check,
  ExternalLink,
  ListTree,
  Phone,
  PhoneOff,
  User,
  Users,
  Voicemail,
  X,
} from 'lucide-vue-next'
import { ivrService, queuesService } from '../lib/services/configuration.service'
import { tenancyService } from '../lib/services/tenancy.service'
import type { Extension, IvrMenu, Queue } from '../lib/services/types'
import { useSessionStore } from '../stores/session'

type DestinationType = 'ivr' | 'queue' | 'extension' | 'voicemail' | 'external_number' | 'hangup'

const props = defineProps<{ open: boolean; submitting?: boolean; error?: string }>()
const emit = defineEmits<{
  cancel: []
  submit: [payload: {
    sourceType: 'phone_number'
    sourceValue: string
    destinationType: DestinationType
    destinationId?: string
    destinationValue?: string
    enabled: boolean
  }]
}>()

const DESTINATIONS: Array<{ type: DestinationType; label: string; description: string; icon: Component }> = [
  { type: 'ivr', label: 'IVR Menu', description: 'Multi-level auto attendant with keypress options', icon: ListTree },
  { type: 'queue', label: 'Agent Queue', description: 'ACD queue with hold music & agent routing', icon: Users },
  { type: 'extension', label: 'Extension', description: 'Direct softphone or deskphone line', icon: User },
  { type: 'voicemail', label: 'Voicemail', description: 'Direct caller to box with email transcript', icon: Voicemail },
  { type: 'external_number', label: 'External PSTN', description: 'Forward out to cell or emergency answering', icon: ExternalLink },
  { type: 'hangup', label: 'Hangup', description: 'Immediately disconnect the caller', icon: PhoneOff },
]

const session = useSessionStore()
const token = computed(() => session.current?.token ?? '')

const sourceValue = ref('')
const destinationType = ref<DestinationType>('ivr')
const destinationId = ref('')
const destinationValue = ref('')
const enabled = ref(true)
const localError = ref('')

const ivrMenus = ref<IvrMenu[]>([])
const queues = ref<Queue[]>([])
const extensions = ref<Extension[]>([])
const optionsLoading = ref(false)

const needsIdTarget = computed(
  () =>
    destinationType.value === 'ivr' ||
    destinationType.value === 'queue' ||
    destinationType.value === 'extension' ||
    destinationType.value === 'voicemail',
)

function extensionLabel(extension: Extension): string {
  const owner = extension.userInfo?.name || extension.callerIdName
  return owner ? `${extension.extension} — ${owner}` : `${extension.extension} — Unassigned`
}

const targetOptions = computed(() => {
  switch (destinationType.value) {
    case 'ivr':
      return ivrMenus.value.map((item) => ({ id: item.id, label: item.name || 'Untitled IVR menu' }))
    case 'queue':
      return queues.value.map((item) => ({ id: item.id, label: item.name }))
    case 'extension':
    case 'voicemail':
      return extensions.value.map((item) => ({ id: item.id, label: extensionLabel(item) }))
    default:
      return []
  }
})

const targetPlaceholder = computed(() => {
  if (optionsLoading.value) return 'Loading…'
  switch (destinationType.value) {
    case 'ivr':
      return 'Select an IVR menu'
    case 'queue':
      return 'Select an agent queue'
    default:
      return 'Select an extension'
  }
})

const targetEmptyHint = computed(() => {
  switch (destinationType.value) {
    case 'ivr':
      return 'No IVR menus yet — create one first.'
    case 'queue':
      return 'No agent queues yet — create one first.'
    default:
      return 'No extensions available for this tenant.'
  }
})

const selectedIvr = computed(() => ivrMenus.value.find((item) => item.id === destinationId.value) ?? null)
const selectedQueue = computed(() => queues.value.find((item) => item.id === destinationId.value) ?? null)
const selectedExtension = computed(() => extensions.value.find((item) => item.id === destinationId.value) ?? null)

const isReady = computed(() => {
  if (!sourceValue.value.trim()) return false
  if (needsIdTarget.value && !destinationId.value) return false
  if (destinationType.value === 'external_number' && !destinationValue.value.trim()) return false
  return true
})

async function loadTargetOptions() {
  if (!token.value) return
  optionsLoading.value = true
  try {
    const [ivrResult, queueResult, extensionResult] = await Promise.allSettled([
      ivrService.list(token.value),
      queuesService.list(token.value),
      tenancyService.extensions(token.value),
    ])
    ivrMenus.value = ivrResult.status === 'fulfilled' ? ivrResult.value : []
    queues.value = queueResult.status === 'fulfilled' ? queueResult.value : []
    extensions.value = extensionResult.status === 'fulfilled' ? extensionResult.value : []
  } finally {
    optionsLoading.value = false
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    sourceValue.value = ''
    destinationType.value = 'ivr'
    destinationId.value = ''
    destinationValue.value = ''
    enabled.value = true
    localError.value = ''
    void loadTargetOptions()
  },
)

function selectDestination(type: DestinationType) {
  destinationType.value = type
  destinationId.value = ''
  destinationValue.value = ''
}

function onSubmit() {
  localError.value = ''
  if (!sourceValue.value.trim()) {
    localError.value = 'Enter the inbound phone number or DID.'
    return
  }
  if (needsIdTarget.value && !destinationId.value) {
    localError.value = 'Select a destination to route calls to.'
    return
  }
  if (destinationType.value === 'external_number' && !destinationValue.value.trim()) {
    localError.value = 'Enter an external destination number.'
    return
  }
  emit('submit', {
    sourceType: 'phone_number',
    sourceValue: sourceValue.value.trim(),
    destinationType: destinationType.value,
    destinationId: needsIdTarget.value ? destinationId.value : undefined,
    destinationValue: destinationType.value === 'external_number' ? destinationValue.value.trim() : undefined,
    enabled: enabled.value,
  })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="route-modal-backdrop" role="presentation" @click.self="emit('cancel')">
      <section class="route-modal" role="dialog" aria-modal="true" aria-labelledby="route-modal-title">
        <header class="route-modal__header">
          <div class="route-modal__tags">
            <span class="route-modal__badge">Call routing engine</span>
            <span class="route-modal__meta">PJSIP inbound</span>
          </div>
          <button class="route-modal__close" type="button" aria-label="Close" @click="emit('cancel')">
            <X :size="16" />
          </button>
        </header>

        <div class="route-modal__intro">
          <h2 id="route-modal-title">New inbound route</h2>
          <p>Map an incoming carrier DID or SIP trunk number to a destination inside your PBX.</p>
        </div>

        <form class="route-modal__form" @submit.prevent="onSubmit">
          <div class="route-modal__section">
            <div class="route-modal__section-label">
              <span>Inbound source</span>
              <span class="route-modal__section-hint">When this number receives a call</span>
            </div>
            <div class="route-modal__source">
              <span class="route-modal__source-icon" aria-hidden="true"><Phone :size="16" /></span>
              <input v-model="sourceValue" type="text" placeholder="+14155550100" required />
            </div>
          </div>

          <div class="route-modal__section">
            <div class="route-modal__section-label">
              <span>Destination</span>
              <span class="route-modal__section-hint">Send incoming calls to</span>
            </div>

            <div class="route-modal__destinations">
              <button
                v-for="option in DESTINATIONS"
                :key="option.type"
                type="button"
                class="route-destination"
                :class="{ 'is-selected': destinationType === option.type }"
                :aria-pressed="destinationType === option.type"
                @click="selectDestination(option.type)"
              >
                <span v-if="destinationType === option.type" class="route-destination__check" aria-hidden="true">
                  <Check :size="12" />
                </span>
                <span class="route-destination__icon" aria-hidden="true">
                  <component :is="option.icon" :size="17" />
                </span>
                <span class="route-destination__copy">
                  <strong>{{ option.label }}</strong>
                  <small>{{ option.description }}</small>
                </span>
              </button>
            </div>

            <div v-if="needsIdTarget" class="route-modal__target">
              <select v-model="destinationId" required>
                <option value="" disabled>{{ targetPlaceholder }}</option>
                <option v-for="item in targetOptions" :key="item.id" :value="item.id">{{ item.label }}</option>
              </select>

              <p v-if="!optionsLoading && targetOptions.length === 0" class="route-modal__empty-hint">
                {{ targetEmptyHint }}
              </p>

              <div v-if="destinationType === 'ivr' && selectedIvr" class="route-modal__preview">
                <span class="route-modal__preview-icon" aria-hidden="true"><ListTree :size="14" /></span>
                <span><strong>{{ selectedIvr.name || 'Untitled IVR menu' }}</strong><br />{{ selectedIvr.description || 'No description' }}</span>
              </div>
              <div v-if="destinationType === 'queue' && selectedQueue" class="route-modal__preview">
                <span class="route-modal__preview-icon" aria-hidden="true"><Users :size="14" /></span>
                <span><strong>{{ selectedQueue.name }}</strong><br />Strategy: {{ selectedQueue.strategy }} · {{ selectedQueue.enabled ? 'Enabled' : 'Disabled' }}</span>
              </div>
              <div v-if="(destinationType === 'extension' || destinationType === 'voicemail') && selectedExtension" class="route-modal__preview">
                <span class="route-modal__preview-icon" aria-hidden="true"><User :size="14" /></span>
                <span><strong>{{ selectedExtension.extension }}</strong><br />{{ selectedExtension.userInfo?.name || selectedExtension.callerIdName || 'Unassigned' }}</span>
              </div>
            </div>

            <div v-else-if="destinationType === 'external_number'" class="route-modal__target">
              <input v-model="destinationValue" type="text" placeholder="+14155550138" required />
            </div>

            <p v-else class="route-modal__empty-hint">Calls to this destination will be disconnected immediately.</p>
          </div>

          <div class="route-modal__toggle-row">
            <p>
              Enabled
              <small>Disabled routes are kept but never matched against inbound calls.</small>
            </p>
            <button
              class="route-modal__toggle"
              type="button"
              role="switch"
              :aria-checked="enabled"
              @click="enabled = !enabled"
            >
              <span class="route-modal__toggle-thumb" />
            </button>
          </div>

          <p v-if="localError || error" class="route-modal__error" role="alert">{{ localError || error }}</p>

          <footer class="route-modal__footer">
            <span class="route-modal__status">
              <span class="route-modal__status-dot" :class="{ 'is-ready': isReady }" aria-hidden="true" />
              {{ isReady ? 'Ready to create' : 'Missing required fields' }}
            </span>
            <div class="route-modal__actions">
              <button class="button button--secondary" type="button" @click="emit('cancel')">Cancel</button>
              <button class="button button--primary" type="submit" :disabled="submitting || !isReady">
                {{ submitting ? 'Creating…' : 'Create route' }}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>
