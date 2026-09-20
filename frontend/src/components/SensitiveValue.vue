<script setup lang="ts">
import { ref } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'

defineProps<{ value?: string | null; writeOnly?: boolean }>()
const revealed = ref(false)
</script>

<template><span class="sensitive-value"><span>{{ writeOnly ? 'Write-only secret' : revealed ? (value ?? 'Unavailable') : '••••••••' }}</span><button v-if="!writeOnly" class="icon-button" type="button" :aria-label="revealed ? 'Hide value' : 'Show value'" @click="revealed = !revealed"><EyeOff v-if="revealed" :size="14" /><Eye v-else :size="14" /></button></span></template>
