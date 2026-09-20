<script setup lang="ts">
defineProps<{ open: boolean; title: string; message: string; confirmLabel?: string }>()
const emit = defineEmits<{ cancel: []; confirm: [] }>()
</script>

<template><div v-if="open" class="dialog-backdrop" role="presentation" @click.self="emit('cancel')"><section class="dialog" role="dialog" aria-modal="true" :aria-label="title"><span class="overline">Confirmation required</span><h2>{{ title }}</h2><p>{{ message }}</p><div class="dialog__actions"><button class="button button--secondary" type="button" @click="emit('cancel')">Cancel</button><button class="button button--primary" type="button" @click="emit('confirm')">{{ confirmLabel ?? 'Confirm' }}</button></div></section></div></template>
