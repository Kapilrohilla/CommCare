<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowRight, Building2, Check, Link2, Shield, X } from 'lucide-vue-next'
import { useSessionStore } from '../stores/session'

const props = defineProps<{
  open: boolean
  submitting?: boolean
  error?: string
}>()

const emit = defineEmits<{
  cancel: []
  signOut: []
  submit: [payload: { name: string; region: string }]
}>()

type RegionId = 'us-east' | 'eu-west'

const REGIONS: Array<{ id: RegionId; title: string; detail: string }> = [
  { id: 'us-east', title: 'US East (Virginia)', detail: 'PJSIP Cluster 01' },
  { id: 'eu-west', title: 'EU West (Ireland)', detail: 'PJSIP Cluster 02' },
]

const session = useSessionStore()
const name = ref('')
const region = ref<RegionId>('us-east')
const localError = ref('')

const signedInAs = computed(() => session.current?.user || 'your account')

const slug = computed(() => {
  const base = name.value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || 'your-workspace'
})

const nameValid = computed(() => name.value.trim().length >= 2)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    name.value = session.current?.tenant && session.current.tenant !== 'Workspace'
      ? session.current.tenant
      : ''
    region.value = 'us-east'
    localError.value = ''
  },
)

function onSubmit() {
  localError.value = ''
  if (!name.value.trim()) {
    localError.value = 'Enter a workspace name.'
    return
  }
  emit('submit', { name: name.value.trim(), region: region.value })
}
</script>

<template>
  <div v-if="open" class="tenant-modal-backdrop" role="presentation">
    <section class="tenant-modal" role="dialog" aria-modal="true" aria-labelledby="tenant-modal-title">
      <header class="tenant-modal__chrome">
        <p class="tenant-modal__step">
          <span class="tenant-modal__step-dot" aria-hidden="true" />
          Step 1 of 3 · Tenant initialization
        </p>
        <button class="tenant-modal__close" type="button" aria-label="Close" @click="emit('cancel')">
          <X :size="16" />
        </button>
      </header>

      <div class="tenant-modal__intro">
        <div class="tenant-modal__icon" aria-hidden="true">
          <Building2 :size="22" />
        </div>
        <div class="tenant-modal__intro-copy">
          <span class="tenant-modal__badge">Workspace setup</span>
          <h2 id="tenant-modal-title">Create your tenant</h2>
          <p>
            Your administrator account is ready. Configure a dedicated tenant workspace to manage
            extensions, SIP routing, and real-time operations.
          </p>
        </div>
      </div>

      <form class="tenant-modal__form" @submit.prevent="onSubmit">
        <div class="tenant-modal__field">
          <div class="tenant-modal__label-row">
            <label for="tenant-workspace-name">Workspace name <span aria-hidden="true">*</span></label>
            <span class="tenant-modal__hint">Can be renamed later</span>
          </div>
          <div class="tenant-modal__input" :class="{ 'is-valid': nameValid }">
            <input
              id="tenant-workspace-name"
              v-model="name"
              type="text"
              placeholder="Atlas Field Ops"
              autocomplete="organization"
              required
            />
            <Check v-if="nameValid" class="tenant-modal__check" :size="16" aria-hidden="true" />
          </div>
          <div class="tenant-modal__slug">
            <Link2 :size="14" aria-hidden="true" />
            <span>Slug: <strong>{{ slug }}</strong>.commcare.io</span>
          </div>
        </div>

        <fieldset class="tenant-modal__regions">
          <legend>Primary telephony region</legend>
          <div class="tenant-modal__region-grid">
            <button
              v-for="item in REGIONS"
              :key="item.id"
              type="button"
              class="tenant-region"
              :class="{ 'is-selected': region === item.id }"
              :aria-pressed="region === item.id"
              @click="region = item.id"
            >
              <span class="tenant-region__radio" aria-hidden="true" />
              <span class="tenant-region__copy">
                <strong>{{ item.title }}</strong>
                <small>{{ item.detail }}</small>
              </span>
            </button>
          </div>
        </fieldset>

        <p v-if="localError || error" class="tenant-modal__error" role="alert">{{ localError || error }}</p>

        <button class="tenant-modal__submit" type="submit" :disabled="submitting || !nameValid">
          {{ submitting ? 'Creating workspace...' : 'Create workspace' }}
          <ArrowRight :size="16" aria-hidden="true" />
        </button>

        <p class="tenant-modal__account">
          Signed in as {{ signedInAs }}
          <span aria-hidden="true"> · </span>
          <button type="button" class="tenant-modal__signout" @click="emit('signOut')">Sign out instead</button>
        </p>
      </form>

      <footer class="tenant-modal__footer">
        <span class="tenant-modal__secure">
          <Shield :size="13" aria-hidden="true" />
          Multi-tenant isolation active
        </span>
        <span class="tenant-modal__version">v2.14.0-prod</span>
      </footer>
    </section>
  </div>
</template>
