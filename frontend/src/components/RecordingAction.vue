<script setup lang="ts">
import { computed } from 'vue'
import { Download, Play } from 'lucide-vue-next'
import { safeRecordingHref } from '../lib/security/redact'

const props = defineProps<{
  available?: boolean
  url?: string | null
  label?: string
}>()

const href = computed(() => (props.available ? safeRecordingHref(props.url) : null))
const stateLabel = computed(() => {
  if (href.value) return props.label ?? 'Recording ready'
  if (props.available) return 'Unavailable'
  return 'None'
})
</script>

<template>
  <div class="recording-action">
    <template v-if="href">
      <a class="button button--secondary button--compact" :href="href" target="_blank" rel="noreferrer">
        <Play :size="14" /> Play
      </a>
      <a class="button button--secondary button--compact" :href="href" download rel="noreferrer">
        <Download :size="14" /> Download
      </a>
    </template>
    <span v-else class="recording-chip" :class="{ 'recording-chip--none': !available }">{{ stateLabel }}</span>
  </div>
</template>
