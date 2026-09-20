<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ status: string }>()
const tone = computed(() => {
  const normalized = props.status.toLowerCase().replace(/\s+/g, '_')
  if (['connected', 'completed', 'healthy', 'active', 'assigned', 'answered', 'delivered'].includes(normalized)) return 'good'
  if (['failed', 'rejected', 'unavailable', 'busy', 'inactive', 'blocked'].includes(normalized)) return 'danger'
  return 'warn'
})
</script>

<template>
  <span class="status-pill" :class="`status-pill--${tone}`">{{ status }}</span>
</template>
