<script setup lang="ts">
defineProps<{ columns: string[]; empty?: boolean }>()
</script>

<template><div class="table-surface surface"><div class="table-scroll"><table><thead><tr><th v-for="column in columns" :key="column">{{ column }}</th></tr></thead><tbody v-if="!empty"><slot /></tbody></table><div v-if="empty" class="empty-state"><strong>No records found</strong><p>Try adjusting the filters or refresh the data.</p></div></div></div></template>
