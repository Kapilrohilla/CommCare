<script setup lang="ts">
import { Bell, CircleHelp, Menu, Search } from 'lucide-vue-next'

defineProps<{ title: string }>()
const emit = defineEmits<{ openNavigation: [] }>()
</script>

<template>
  <header class="topbar">
    <button class="icon-button mobile-only" aria-label="Open navigation" @click="emit('openNavigation')"><Menu :size="20" /></button>
    <div class="breadcrumbs"><span>Workspace</span><span class="breadcrumbs__slash">/</span><strong>{{ title }}</strong></div>
    <div class="topbar__actions"><button class="search-trigger"><Search :size="16" /><span>Search</span><kbd>⌘ K</kbd></button><button class="icon-button" aria-label="Help"><CircleHelp :size="18" /></button><button class="icon-button notification" aria-label="Notifications"><Bell :size="18" /><i /></button></div>
  </header>
</template>
