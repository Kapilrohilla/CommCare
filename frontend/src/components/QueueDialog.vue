<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, Trash2, X } from 'lucide-vue-next'
import { queueMembersService, queuesService } from '../lib/services/configuration.service'
import { recordingsService, type SystemRecording } from '../lib/services/integrations.service'
import { tenancyService } from '../lib/services/tenancy.service'
import type { Queue, QueueMember, QueueStrategy, TenantUser } from '../lib/services/types'
import { useSessionStore } from '../stores/session'

const STRATEGIES: Array<{ value: QueueStrategy; label: string }> = [
  { value: 'ring_all', label: 'Ring all' },
  { value: 'round_robin', label: 'Round robin' },
  { value: 'least_recent', label: 'Least recent' },
  { value: 'fewest_calls', label: 'Fewest calls' },
  { value: 'random', label: 'Random' },
]

const props = defineProps<{ open: boolean; queue?: Queue | null; error?: string }>()
const emit = defineEmits<{ cancel: []; saved: [] }>()

const session = useSessionStore()
const token = computed(() => session.current?.token ?? '')
const isEdit = computed(() => Boolean(props.queue))

const name = ref('')
const description = ref('')
const strategy = ref<QueueStrategy>('ring_all')
const ringTimeoutSeconds = ref(15)
const maxWaitTimeSeconds = ref(300)
const maxCallers = ref<number | null>(null)
const musicOnHoldId = ref('')
const enabled = ref(true)

const submitting = ref(false)
const localError = ref('')

const recordings = ref<SystemRecording[]>([])
const users = ref<TenantUser[]>([])
const members = ref<QueueMember[]>([])
const membersLoading = ref(false)
const memberError = ref('')
const newMemberId = ref('')

const userNameById = computed(() => {
  const map = new Map<string, string>()
  for (const user of users.value) map.set(user.id, user.name)
  return map
})

const availableUsers = computed(() => {
  const memberIds = new Set(members.value.map((m) => m.agentId))
  return users.value.filter((user) => !memberIds.has(user.id))
})

function resetForm() {
  const queue = props.queue
  name.value = queue?.name ?? ''
  description.value = queue?.description ?? ''
  strategy.value = queue?.strategy ?? 'ring_all'
  ringTimeoutSeconds.value = queue?.ringTimeoutSeconds ?? 15
  maxWaitTimeSeconds.value = queue?.maxWaitTimeSeconds ?? 300
  maxCallers.value = queue?.maxCallers ?? null
  musicOnHoldId.value = queue?.musicOnHoldId ?? ''
  enabled.value = queue?.enabled ?? true
  localError.value = ''
  memberError.value = ''
  members.value = []
  newMemberId.value = ''
}

async function loadLookups() {
  if (!token.value) return
  const [recordingResult, userResult] = await Promise.allSettled([
    recordingsService.list(token.value),
    tenancyService.users(token.value),
  ])
  recordings.value = recordingResult.status === 'fulfilled' ? recordingResult.value : []
  users.value = userResult.status === 'fulfilled' ? userResult.value : []
}

async function loadMembers() {
  if (!props.queue || !token.value) return
  membersLoading.value = true
  try {
    members.value = await queueMembersService.list(props.queue.id, token.value)
  } catch {
    members.value = []
  } finally {
    membersLoading.value = false
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    resetForm()
    void loadLookups()
    void loadMembers()
  },
)

async function addMember() {
  if (!props.queue || !newMemberId.value) return
  memberError.value = ''
  try {
    await queueMembersService.add(props.queue.id, { agentId: newMemberId.value }, token.value)
    newMemberId.value = ''
    await loadMembers()
  } catch (error) {
    memberError.value = error instanceof Error ? error.message : 'Could not add member.'
  }
}

async function removeMember(agentId: string) {
  if (!props.queue) return
  memberError.value = ''
  try {
    await queueMembersService.remove(props.queue.id, agentId, token.value)
    await loadMembers()
  } catch (error) {
    memberError.value = error instanceof Error ? error.message : 'Could not remove member.'
  }
}

async function onSubmit() {
  localError.value = ''
  if (!name.value.trim()) {
    localError.value = 'Enter a queue name.'
    return
  }
  if (ringTimeoutSeconds.value > maxWaitTimeSeconds.value) {
    localError.value = 'Ring timeout cannot be greater than max wait time.'
    return
  }

  submitting.value = true
  try {
    const payload: Partial<Queue> = {
      name: name.value.trim(),
      description: description.value.trim() || undefined,
      strategy: strategy.value,
      ringTimeoutSeconds: ringTimeoutSeconds.value,
      maxWaitTimeSeconds: maxWaitTimeSeconds.value,
      maxCallers: maxCallers.value,
      musicOnHoldId: musicOnHoldId.value || null,
      enabled: enabled.value,
    }

    if (isEdit.value) {
      await queuesService.update(props.queue!.id, payload, token.value)
    } else {
      await queuesService.create(payload, token.value)
    }

    emit('saved')
  } catch (error) {
    localError.value = error instanceof Error ? error.message : 'Queue could not be saved.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="queue-modal-backdrop" role="presentation" @click.self="emit('cancel')">
      <section class="queue-modal" role="dialog" aria-modal="true" aria-labelledby="queue-modal-title">
        <header class="queue-modal__header">
          <span class="queue-modal__badge">Agent queues &amp; hunt groups</span>
          <button class="queue-modal__close" type="button" aria-label="Close" @click="emit('cancel')">
            <X :size="16" />
          </button>
        </header>

        <div class="queue-modal__intro">
          <h2 id="queue-modal-title">{{ isEdit ? 'Edit queue' : 'New queue' }}</h2>
          <p>Configure the distribution strategy, timeouts, and hold music for this ACD queue.</p>
        </div>

        <form class="queue-modal__form" @submit.prevent="onSubmit">
          <div class="queue-modal__body">
            <div class="queue-modal__section">
              <p class="queue-modal__section-title">Queue identity</p>
              <div class="queue-modal__field">
                <label>Name <span style="color:#d17a6d">*</span></label>
                <input v-model="name" type="text" placeholder="Sales Queue" required />
              </div>
              <div class="queue-modal__field">
                <label>Description (optional)</label>
                <textarea v-model="description" placeholder="Internal notes about this queue" />
              </div>
              <div class="queue-modal__row">
                <p>
                  Enabled
                  <small>Disabled queues are kept but never receive routed calls.</small>
                </p>
                <button
                  class="queue-modal__toggle"
                  type="button"
                  role="switch"
                  :aria-checked="enabled"
                  @click="enabled = !enabled"
                >
                  <span class="queue-modal__toggle-thumb" />
                </button>
              </div>
            </div>

            <div class="queue-modal__section">
              <p class="queue-modal__section-title">Distribution &amp; timing</p>
              <div class="queue-modal__grid-3">
                <div class="queue-modal__field">
                  <label>Strategy</label>
                  <select v-model="strategy">
                    <option v-for="item in STRATEGIES" :key="item.value" :value="item.value">{{ item.label }}</option>
                  </select>
                </div>
                <div class="queue-modal__field">
                  <label>Ring timeout (sec)</label>
                  <input v-model.number="ringTimeoutSeconds" type="number" min="5" max="120" />
                </div>
                <div class="queue-modal__field">
                  <label>Max wait time (sec)</label>
                  <input v-model.number="maxWaitTimeSeconds" type="number" min="10" max="3600" />
                </div>
              </div>
              <div class="queue-modal__grid-2">
                <div class="queue-modal__field">
                  <label>Max callers waiting (optional)</label>
                  <input v-model.number="maxCallers" type="number" min="0" placeholder="Unlimited" />
                </div>
                <div class="queue-modal__field">
                  <label>Music on hold</label>
                  <select v-model="musicOnHoldId">
                    <option value="">Default</option>
                    <option v-for="recording in recordings" :key="recording.id" :value="recording.id">
                      {{ recording.name }}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <div v-if="isEdit" class="queue-modal__section">
              <div class="queue-modal__section-head">
                <p class="queue-modal__section-title">Members</p>
                <span class="queue-modal__chip">{{ members.length }} agents</span>
              </div>

              <div class="queue-member-add">
                <select v-model="newMemberId">
                  <option value="" disabled>{{ membersLoading ? 'Loading…' : 'Select an agent to add' }}</option>
                  <option v-for="user in availableUsers" :key="user.id" :value="user.id">{{ user.name }}</option>
                </select>
                <button class="button button--secondary button--compact" type="button" :disabled="!newMemberId" @click="addMember">
                  <Plus :size="14" /> Add
                </button>
              </div>

              <p v-if="!membersLoading && !members.length" class="queue-modal__helper">
                No agents assigned yet — add one above so calls have someone to ring.
              </p>

              <div v-else class="queue-member-list">
                <div v-for="member in members" :key="member.id" class="queue-member-row">
                  <span>{{ userNameById.get(member.agentId) || 'Unknown agent' }}</span>
                  <button class="queue-member-row__remove" type="button" aria-label="Remove member" @click="removeMember(member.agentId)">
                    <Trash2 :size="14" />
                  </button>
                </div>
              </div>

              <p v-if="memberError" class="queue-modal__error" role="alert">{{ memberError }}</p>
            </div>

            <p v-if="localError || error" class="queue-modal__error" role="alert">{{ localError || error }}</p>
          </div>

          <footer class="queue-modal__footer">
            <span />
            <div class="queue-modal__actions">
              <button class="button button--secondary" type="button" @click="emit('cancel')">Cancel</button>
              <button class="button button--primary" type="submit" :disabled="submitting">
                {{ submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create queue' }}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  </Teleport>
</template>
