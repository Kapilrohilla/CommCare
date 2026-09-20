<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import Sidebar from './Sidebar.vue'
import ScreenHeader from './ScreenHeader.vue'
import { useSessionStore } from '../stores/session'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const navOpen = ref(false)
const pageTitle = computed(() => String(route.meta.title ?? 'Overview'))

function signOut() { session.clear(); router.push({ name: 'sign-in' }) }
</script>

<template>
  <div class="app-frame">
    <div v-if="navOpen" class="scrim" @click="navOpen = false" />
    <Sidebar :open="navOpen" :role="session.current?.role?.toLowerCase()" @close="navOpen = false" @sign-out="signOut" />
    <main class="main-column">
      <ScreenHeader :title="pageTitle" @open-navigation="navOpen = true" />
      <div class="content-wrap"><RouterView /></div>
    </main>
  </div>
</template>
