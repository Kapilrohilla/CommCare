<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { Activity, Bell, ChevronDown, CircleHelp, Command, LayoutDashboard, LogOut, Menu, Phone, Radio, Search, Settings2, ShieldCheck, Users, X } from 'lucide-vue-next'
import { useSessionStore } from './stores/session'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const navOpen = ref(false)
const navItems = [
  { label: 'Overview', to: '/', icon: LayoutDashboard },
  { label: 'Call activity', to: '/calls', icon: Phone },
  { label: 'People & extensions', to: '/people', icon: Users },
  { label: 'Inbound & IVR', to: '/inbound', icon: Radio },
  { label: 'SIP trunks', to: '/trunks', icon: Settings2 },
  { label: 'Webhooks', to: '/webhooks', icon: Activity },
  { label: 'System health', to: '/health', icon: ShieldCheck },
]
const pageTitle = computed(() => String(route.meta.title ?? 'Overview'))
function signOut() { session.clear(); router.push({ name: 'sign-in' }) }
</script>

<template>
  <div v-if="route.name === 'sign-in'" class="auth-frame"><RouterView /></div>
  <div v-else class="app-frame">
    <div v-if="navOpen" class="scrim" @click="navOpen = false" />
    <aside class="rail" :class="{ 'rail--open': navOpen }">
      <div class="rail__topline"><RouterLink to="/" class="brand" @click="navOpen = false"><span class="brand__mark"><Command :size="17" /></span><span>commcare</span></RouterLink><button class="icon-button mobile-only" aria-label="Close navigation" @click="navOpen = false"><X :size="18" /></button></div>
      <div class="workspace-switcher"><span class="workspace-switcher__avatar">AF</span><span class="workspace-switcher__copy"><strong>Atlas Field Ops</strong><small>Operations workspace</small></span><ChevronDown :size="15" class="muted" /></div>
      <nav class="nav-list" aria-label="Main navigation"><p class="nav-list__label">Workspace</p><RouterLink v-for="item in navItems" :key="item.to" :to="item.to" class="nav-link" active-class="nav-link--active" @click="navOpen = false"><component :is="item.icon" :size="17" stroke-width="1.8" /><span>{{ item.label }}</span></RouterLink></nav>
      <div class="rail__bottom"><RouterLink to="/settings" class="nav-link" active-class="nav-link--active" @click="navOpen = false"><Settings2 :size="17" /><span>Settings</span></RouterLink><button class="profile-chip" @click="signOut"><span class="profile-chip__avatar">JD</span><span><strong>Jordan Diaz</strong><small>Administrator</small></span><LogOut :size="15" class="muted" /></button></div>
    </aside>
    <main class="main-column">
      <header class="topbar"><button class="icon-button mobile-only" aria-label="Open navigation" @click="navOpen = true"><Menu :size="20" /></button><div class="breadcrumbs"><span>Workspace</span><span class="breadcrumbs__slash">/</span><strong>{{ pageTitle }}</strong></div><div class="topbar__actions"><button class="search-trigger"><Search :size="16" /><span>Search</span><kbd>⌘ K</kbd></button><button class="icon-button" aria-label="Help"><CircleHelp :size="18" /></button><button class="icon-button notification" aria-label="Notifications"><Bell :size="18" /><i /></button></div></header>
      <div class="content-wrap"><RouterView /></div>
    </main>
  </div>
</template>
