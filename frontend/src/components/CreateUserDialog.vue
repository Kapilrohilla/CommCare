<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import {
  Check,
  Copy,
  Grid3x3,
  Info,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  UserRound,
  X,
} from 'lucide-vue-next'
import type { Extension } from '../lib/services/types'

const props = defineProps<{
  open: boolean
  extensions: Extension[]
  submitting?: boolean
  error?: string
}>()

const emit = defineEmits<{
  cancel: []
  submit: [payload: { name: string; extensionIds: string[]; status: 'active' | 'inactive' }]
}>()

const ROLES = [
  'Call operator (Standard Inbound/Outbound Softphone)',
  'Supervisor (Monitor + barge-in)',
  'Administrator (Full directory access)',
] as const

const name = ref('')
const email = ref('')
const phoneCountry = ref('+1')
const phone = ref('')
const extensionId = ref('')
const allowOutbound = ref(true)
const role = ref<(typeof ROLES)[number]>(ROLES[0])
const temporaryPassword = ref('')
const accountActive = ref(true)
const localError = ref('')
const copied = ref(false)

const availableExtensions = computed(() =>
  props.extensions.filter((item) => !item.userId && item.status !== 'disabled'),
)

const selectedExtension = computed(() =>
  availableExtensions.value.find((item) => item.id === extensionId.value) ?? null,
)

const endpointHint = computed(() => {
  const ext = selectedExtension.value?.extension
  return ext ? `SIP endpoint endpoint_${ext} is verified & idle on Asterisk dialplan` : ''
})

watch(
  () => props.open,
  (open) => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = open ? 'hidden' : ''
    }
    if (!open) return
    name.value = ''
    email.value = ''
    phoneCountry.value = '+1'
    phone.value = ''
    extensionId.value = availableExtensions.value[0]?.id ?? ''
    allowOutbound.value = true
    role.value = ROLES[0]
    temporaryPassword.value = generatePassword()
    accountActive.value = true
    localError.value = ''
    copied.value = false
  },
)

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
  }
})

function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*'
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

async function copyPassword() {
  try {
    await navigator.clipboard.writeText(temporaryPassword.value)
    copied.value = true
    window.setTimeout(() => {
      copied.value = false
    }, 1600)
  } catch {
    localError.value = 'Could not copy password to clipboard.'
  }
}

function regeneratePassword() {
  temporaryPassword.value = generatePassword()
  copied.value = false
}

function onSubmit() {
  localError.value = ''
  if (!name.value.trim()) {
    localError.value = 'Enter a full name.'
    return
  }
  if (!email.value.trim() || !email.value.includes('@')) {
    localError.value = 'Enter a valid work email address.'
    return
  }
  if (!extensionId.value) {
    localError.value = 'Assign an available internal extension.'
    return
  }
  emit('submit', {
    name: name.value.trim(),
    extensionIds: [extensionId.value],
    status: accountActive.value ? 'active' : 'inactive',
  })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="user-modal-backdrop" role="presentation" @click.self="emit('cancel')">
      <section class="user-modal" role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
        <header class="user-modal__header">
          <div class="user-modal__tags">
            <span class="user-modal__badge">Directory · User provisioning</span>
            <span class="user-modal__meta">Asterisk PJSIP / WebRTC</span>
          </div>
          <button class="user-modal__close" type="button" aria-label="Close" @click="emit('cancel')">
            <X :size="16" />
          </button>
        </header>

        <div class="user-modal__intro">
          <h2 id="user-modal-title">New user</h2>
          <p>Create a tenant teammate, provision softphone credentials, and assign an internal extension.</p>
        </div>

        <form class="user-modal__form" @submit.prevent="onSubmit">
          <div class="user-modal__body">
            <div class="user-modal__grid">
              <section class="user-modal__section">
                <h3 class="user-modal__section-title">
                  <UserRound :size="14" aria-hidden="true" />
                  Personal details
                </h3>

                <div class="user-modal__field">
                  <label for="user-name">Full name <span aria-hidden="true">*</span></label>
                  <input id="user-name" v-model="name" type="text" placeholder="Elena Rostova" autocomplete="name" required />
                </div>

                <div class="user-modal__field">
                  <label for="user-email">Work email address <span aria-hidden="true">*</span></label>
                  <input
                    id="user-email"
                    v-model="email"
                    type="email"
                    placeholder="elena.rostova@acmesupport.com"
                    autocomplete="email"
                    required
                  />
                  <p class="user-modal__helper">Used for WebRTC softphone authentication and PBX routing alerts.</p>
                </div>

                <div class="user-modal__field">
                  <label for="user-phone">Mobile / Direct phone number</label>
                  <div class="user-modal__phone">
                    <select v-model="phoneCountry" aria-label="Country code">
                      <option value="+1">🇺🇸 +1 (US)</option>
                      <option value="+44">🇬🇧 +44 (UK)</option>
                      <option value="+91">🇮🇳 +91 (IN)</option>
                    </select>
                    <input id="user-phone" v-model="phone" type="tel" placeholder="+1 (415) 882-9012" autocomplete="tel" />
                  </div>
                  <p class="user-modal__helper">Optional failover number for inbound call diversion.</p>
                </div>
              </section>

              <section class="user-modal__section">
                <div class="user-modal__section-head">
                  <h3 class="user-modal__section-title">
                    <Grid3x3 :size="14" aria-hidden="true" />
                    Extension assignment
                  </h3>
                  <span class="user-modal__chip">{{ availableExtensions.length }} extensions available</span>
                </div>

                <div class="user-modal__field">
                  <label for="user-extension">Assign internal extension <span aria-hidden="true">*</span></label>
                  <select id="user-extension" v-model="extensionId" required>
                    <option disabled value="">Select an available extension</option>
                    <option v-for="item in availableExtensions" :key="item.id" :value="item.id">
                      Ext {{ item.extension }} · {{ item.status }}{{ item.callerIdName ? ` (${item.callerIdName})` : '' }}
                    </option>
                  </select>
                  <p v-if="endpointHint" class="user-modal__verified">
                    <Check :size="13" aria-hidden="true" />
                    {{ endpointHint }}
                  </p>
                  <p v-else-if="!availableExtensions.length" class="user-modal__helper">
                    No unassigned extensions are available. Reserve extensions first.
                  </p>
                </div>

                <div class="user-modal__outbound">
                  <label class="user-modal__check">
                    <input v-model="allowOutbound" type="checkbox" />
                    <span>Allow outbound calling</span>
                  </label>
                  <p>Routes outbound calls through primary SIP trunk (Twilio US-East) using tenant caller ID.</p>
                  <div class="user-modal__outbound-meta">
                    <span>Trunk Caller ID:</span>
                    <strong>+1 (555) 019-4820</strong>
                  </div>
                </div>

                <div class="user-modal__field">
                  <label for="user-role">Directory role</label>
                  <select id="user-role" v-model="role">
                    <option v-for="item in ROLES" :key="item" :value="item">{{ item }}</option>
                  </select>
                </div>
              </section>
            </div>

            <section class="user-modal__credentials">
              <div class="user-modal__section-head">
                <h3 class="user-modal__section-title">
                  <KeyRound :size="14" aria-hidden="true" />
                  Softphone &amp; PBX credentials
                </h3>
                <span class="user-modal__chip user-modal__chip--dark">High Entropy (128-bit)</span>
              </div>

              <div class="user-modal__field">
                <label for="user-password">Generated temporary password</label>
                <div class="user-modal__password">
                  <Lock :size="15" aria-hidden="true" />
                  <input id="user-password" :value="temporaryPassword" type="text" readonly />
                  <button class="button button--secondary" type="button" @click="copyPassword">
                    <Copy :size="14" />
                    {{ copied ? 'Copied' : 'Copy' }}
                  </button>
                  <button class="button button--secondary" type="button" @click="regeneratePassword">
                    <RefreshCw :size="14" />
                    Regenerate
                  </button>
                </div>
              </div>

              <aside class="user-modal__kms">
                <ShieldCheck :size="15" aria-hidden="true" />
                <p>
                  Encrypted via tenant KMS: User will be prompted to reset upon first softphone sign-in. WebRTC auth
                  tokens are dispatched to their work email immediately.
                </p>
              </aside>
            </section>

            <section class="user-modal__status">
              <div>
                <p class="user-modal__status-label">
                  Account Status:
                  <span :class="accountActive ? 'is-active' : 'is-inactive'">
                    <i aria-hidden="true" />
                    {{ accountActive ? 'Active' : 'Inactive' }}
                  </span>
                </p>
                <p class="user-modal__helper">Inactive users cannot register softphones or receive routed calls.</p>
              </div>
              <button
                class="user-modal__toggle"
                type="button"
                role="switch"
                :aria-checked="accountActive"
                @click="accountActive = !accountActive"
              >
                <span class="user-modal__toggle-thumb" />
              </button>
            </section>

            <p v-if="localError || error" class="user-modal__error" role="alert">{{ localError || error }}</p>
          </div>

          <footer class="user-modal__footer">
            <p class="user-modal__footnote">
              <Info :size="14" aria-hidden="true" />
              Changes apply to PBX routing immediately upon creation.
            </p>
            <div class="user-modal__actions">
              <button class="button button--secondary" type="button" @click="emit('cancel')">Cancel</button>
              <button
                class="button button--primary"
                type="submit"
                :disabled="submitting || !availableExtensions.length"
              >
                <UserPlus :size="15" aria-hidden="true" />
                {{ submitting ? 'Provisioning…' : 'Create user & provision' }}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>
