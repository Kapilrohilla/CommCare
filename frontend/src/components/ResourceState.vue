<script setup lang="ts">
import { AlertCircle, CheckCircle2, LoaderCircle, LockKeyhole, RefreshCw } from 'lucide-vue-next'

defineProps<{ state: 'loading' | 'empty' | 'error' | 'forbidden' | 'stale' | 'pending' | 'ready'; title?: string; message?: string; retryable?: boolean }>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div v-if="state !== 'ready'" class="resource-state" :class="`resource-state--${state}`">
    <LoaderCircle v-if="state === 'loading'" class="resource-state__spin" :size="20" />
    <LockKeyhole v-else-if="state === 'forbidden'" :size="20" />
    <AlertCircle v-else-if="state === 'error'" :size="20" />
    <RefreshCw v-else-if="state === 'stale' || state === 'pending'" :size="20" />
    <CheckCircle2 v-else :size="20" />
    <strong>{{ title ?? (state === 'loading' ? 'Loading data' : state === 'empty' ? 'Nothing here yet' : state === 'forbidden' ? 'Access restricted' : state === 'pending' ? 'Action in progress' : 'Something needs attention') }}</strong>
    <p>{{ message ?? (state === 'empty' ? 'There is no data to show yet.' : 'Try again or return later.') }}</p>
    <button v-if="retryable" class="button button--secondary" type="button" @click="emit('retry')">Retry</button>
  </div>
</template>
