<script setup lang="ts">
defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template><div v-if="open" class="drawer-backdrop" @click.self="emit('close')"><aside class="detail-drawer" role="dialog" aria-modal="true" :aria-label="title"><header class="detail-drawer__header"><h2>{{ title }}</h2><button class="icon-button" aria-label="Close details" type="button" @click="emit('close')">×</button></header><div class="detail-drawer__body"><slot /></div></aside></div></template>
