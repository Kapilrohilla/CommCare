<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { Grid3x3, Info, UserRound, X } from 'lucide-vue-next'
import type { Extension, TenantUser } from '../lib/services/types'

const props = defineProps<{
  open: boolean
  user: TenantUser | null
  extensions: Extension[]
  submitting?: boolean
  error?: string
}>()

const emit = defineEmits<{
  cancel: []
  delete: []
  submit: [payload: { name: string; status: 'active' | 'inactive'; extensionId: string | null }]
}>()

const name = ref('')
const extensionId = ref('')
const accountActive = ref(true)
const localError = ref('')

const currentExtensionId = computed(() => props.user?.extensions?.[0]?.id ?? null)

const assignableExtensions = computed(() =>
  props.extensions.filter(
    (item) => (!item.userId && item.status !== 'disabled') || item.id === currentExtensionId.value,
  ),
)

watch(
  () => props.open,
  (open) => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = open ? 'hidden' : ''
    }
    if (!open) return
    name.value = props.user?.name ?? ''
    extensionId.value = currentExtensionId.value ?? ''
    accountActive.value = (props.user?.status ?? 'active') === 'active'
    localError.value = ''
  },
)

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
  }
})

function onSubmit() {
  localError.value = ''
  if (!name.value.trim()) {
    localError.value = 'Enter a full name.'
    return
  }
  emit('submit', {
    name: name.value.trim(),
    status: accountActive.value ? 'active' : 'inactive',
    extensionId: extensionId.value || null,
  })
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="user-modal-backdrop" role="presentation" @click.self="emit('cancel')">
      <section class="user-modal" role="dialog" aria-modal="true" aria-labelledby="edit-user-modal-title">
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
          <h2 id="edit-user-modal-title">Edit user</h2>
          <p>Update this teammate's directory details and internal extension assignment.</p>
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
                  <label for="edit-user-name">Full name <span aria-hidden="true">*</span></label>
                  <input id="edit-user-name" v-model="name" type="text" autocomplete="name" required />
                </div>
              </section>

              <section class="user-modal__section">
                <div class="user-modal__section-head">
                  <h3 class="user-modal__section-title">
                    <Grid3x3 :size="14" aria-hidden="true" />
                    Extension assignment
                  </h3>
                  <span class="user-modal__chip">{{ assignableExtensions.length }} extensions available</span>
                </div>

                <div class="user-modal__field">
                  <label for="edit-user-extension">Assigned internal extension</label>
                  <select id="edit-user-extension" v-model="extensionId">
                    <option value="">No extension assigned</option>
                    <option v-for="item in assignableExtensions" :key="item.id" :value="item.id">
                      Ext {{ item.extension }} · {{ item.status }}{{ item.callerIdName ? ` (${item.callerIdName})` : '' }}
                    </option>
                  </select>
                  <p v-if="!assignableExtensions.length" class="user-modal__helper">
                    No unassigned extensions are available. Reserve extensions first.
                  </p>
                </div>
              </section>
            </div>

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
              Changes apply to PBX routing immediately upon saving.
            </p>
            <div class="user-modal__actions">
              <button class="button button--secondary" type="button" @click="emit('delete')">Delete</button>
              <button class="button button--secondary" type="button" @click="emit('cancel')">Cancel</button>
              <button class="button button--primary" type="submit" :disabled="submitting">
                {{ submitting ? 'Saving…' : 'Save changes' }}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>
